import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createProjectRecord, parseGitHubRepositoryUrl } from "./core/project-model.mjs";
import { detectGodot, inspectSelectedGodot, openGodotEditor, runGodotProject } from "./services/godot.mjs";
import { addProject, loadProjects, removeProject, saveProjects } from "./services/project-registry.mjs";
import { HubError, inspectGit, inspectRepository, prepareProject, syncProject } from "./services/repository.mjs";
import { loadSettings, saveSettings } from "./services/settings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererPath = path.join(__dirname, "renderer", "index.html");
const trustedRendererUrl = pathToFileURL(rendererPath).toString();

let mainWindow;

function defaultProjectsRoot() {
  return path.join(app.getPath("documents"), "Game Dev Hub");
}

function assertTrustedSender(event) {
  if (!event.senderFrame || event.senderFrame.url !== trustedRendererUrl) {
    throw new Error("Rejected IPC sender.");
  }
}

function safeError(error) {
  if (error instanceof HubError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "UNKNOWN",
    message: String(error?.message || "処理に失敗しました。")
  };
}

function registerIpc(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);

    try {
      return await handler(payload);
    } catch (error) {
      const safe = safeError(error);
      return {
        ok: false,
        ...safe
      };
    }
  });
}

async function getSettings() {
  return loadSettings(app.getPath("userData"), {
    projectsRoot: defaultProjectsRoot()
  });
}

async function updateSettings(patch) {
  const current = await getSettings();
  return saveSettings(
    app.getPath("userData"),
    { ...current, ...patch },
    { projectsRoot: defaultProjectsRoot() }
  );
}

async function getRegistry() {
  const settings = await getSettings();
  return loadProjects(app.getPath("userData"), settings.projectsRoot);
}

async function findProject(projectId) {
  if (typeof projectId !== "string" || projectId.length > 100) {
    throw new HubError("INVALID_PROJECT", "Game IDが正しくありません。");
  }

  const registry = await getRegistry();
  const project = registry.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new HubError("PROJECT_NOT_FOUND", "Gameが見つかりません。");
  }

  return project;
}

async function ensureGodot() {
  const settings = await getSettings();
  const godot = await detectGodot(settings.godotPath);

  if (!godot.available) {
    throw new HubError(
      "GODOT_MISSING",
      "Godotが見つかりません。初回だけGodot.exeを選択してください。"
    );
  }

  if (godot.path !== settings.godotPath) {
    await updateSettings({ godotPath: godot.path });
  }

  return godot;
}

async function getState() {
  const settings = await getSettings();
  const registry = await getRegistry();
  const git = await inspectGit();
  const godot = await detectGodot(settings.godotPath);

  if (godot.available && godot.path !== settings.godotPath) {
    await updateSettings({ godotPath: godot.path });
  }

  const projects = [];
  for (const project of registry.projects) {
    const repository = git.available
      ? await inspectRepository(project)
      : { exists: false, valid: false };

    projects.push({ ...project, repository });
  }

  return {
    ok: true,
    appVersion: app.getVersion(),
    settings: {
      projectsRoot: settings.projectsRoot
    },
    git,
    godot,
    projects
  };
}

async function chooseGodot() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Godotの実行ファイルを選ぶ",
    properties: ["openFile"],
    filters: [{ name: "Godot", extensions: ["exe"] }]
  });

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, code: "CANCELED", message: "選択をキャンセルしました。" };
  }

  const godot = await inspectSelectedGodot(result.filePaths[0]);
  await updateSettings({ godotPath: godot.path });

  return {
    ok: true,
    message: "Godotを保存しました。",
    state: await getState()
  };
}

async function addGitHubProject(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "入力が正しくありません。");
  }

  const parsed = parseGitHubRepositoryUrl(payload.repositoryUrl);
  if (!parsed) {
    throw new HubError(
      "INVALID_REPOSITORY_URL",
      "GitHub Repository URLを https://github.com/owner/repository の形で入力してください。"
    );
  }

  const settings = await getSettings();
  const localPath = path.join(settings.projectsRoot, parsed.repo);

  const project = await addProject(
    app.getPath("userData"),
    settings.projectsRoot,
    {
      name: String(payload.name ?? "").trim() || parsed.repo,
      repositoryUrl: parsed.cloneUrl,
      localPath,
      defaultBranch: "main",
      engine: "godot"
    }
  );

  return {
    ok: true,
    message: project.name + " を追加しました。",
    projectId: project.id,
    state: await getState()
  };
}

async function importExistingProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "既存のGodot Repositoryを選ぶ",
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, code: "CANCELED", message: "選択をキャンセルしました。" };
  }

  const localPath = result.filePaths[0];

  try {
    await fs.access(path.join(localPath, "project.godot"));
    await fs.access(path.join(localPath, ".git"));
  } catch {
    throw new HubError(
      "NOT_GODOT_REPOSITORY",
      "project.godot と .git があるGame Repositoryを選んでください。"
    );
  }

  const { runFile } = await import("./core/process.mjs");
  let origin;

  try {
    origin = (await runFile("git", ["remote", "get-url", "origin"], {
      cwd: localPath,
      timeout: 10_000
    })).stdout;
  } catch {
    throw new HubError(
      "ORIGIN_MISSING",
      "このRepositoryにはGitHub originが設定されていません。"
    );
  }

  const parsed = parseGitHubRepositoryUrl(origin);
  if (!parsed) {
    throw new HubError(
      "ORIGIN_INVALID",
      "v0.1ではGitHub Repositoryだけ登録できます。"
    );
  }

  const settings = await getSettings();
  const project = await addProject(
    app.getPath("userData"),
    settings.projectsRoot,
    {
      name: parsed.repo,
      repositoryUrl: parsed.cloneUrl,
      localPath,
      defaultBranch: "main",
      engine: "godot"
    }
  );

  return {
    ok: true,
    message: project.name + " を登録しました。",
    projectId: project.id,
    state: await getState()
  };
}

async function startDevelopment(projectId) {
  const project = await findProject(projectId);
  const prepared = await prepareProject(project);
  const godot = await ensureGodot();
  openGodotEditor(godot.path, project);

  return {
    ok: true,
    message: prepared.action === "cloned"
      ? project.name + " を取得してGodotを開きました。"
      : project.name + " を最新化してGodotを開きました。",
    state: await getState()
  };
}

async function syncSelected(projectId) {
  const project = await findProject(projectId);
  const state = await inspectRepository(project);

  if (!state.exists) {
    await prepareProject(project);
  } else {
    await syncProject(project);
  }

  return {
    ok: true,
    message: project.name + " をGitHubの最新版へ更新しました。",
    state: await getState()
  };
}

async function openEditor(projectId) {
  const project = await findProject(projectId);
  const repository = await inspectRepository(project);

  if (!repository.valid) {
    throw new HubError(
      "REPOSITORY_INVALID",
      "先に「最新版にする」または「開発を開始」を実行してください。"
    );
  }

  const godot = await ensureGodot();
  openGodotEditor(godot.path, project);
  return { ok: true, message: project.name + " をGodotで開きました。" };
}

async function runGame(projectId) {
  const project = await findProject(projectId);
  const repository = await inspectRepository(project);

  if (!repository.valid) {
    throw new HubError("REPOSITORY_INVALID", "Local Repositoryを先に準備してください。");
  }

  const godot = await ensureGodot();
  runGodotProject(godot.path, project);
  return { ok: true, message: project.name + " を起動しました。" };
}

async function openFolder(projectId) {
  const project = await findProject(projectId);

  try {
    await fs.access(project.localPath);
  } catch {
    throw new HubError(
      "REPOSITORY_MISSING",
      "Local Repositoryがまだありません。先に「開発を開始」を押してください。"
    );
  }

  const errorMessage = await shell.openPath(project.localPath);
  if (errorMessage) {
    throw new HubError("OPEN_FOLDER_FAILED", errorMessage);
  }

  return { ok: true, message: "Project folderを開きました。" };
}

async function openGitHub(projectId) {
  const project = await findProject(projectId);
  const parsed = parseGitHubRepositoryUrl(project.repositoryWebUrl);

  if (!parsed) {
    throw new HubError("URL_INVALID", "GitHub URLが正しくありません。");
  }

  await shell.openExternal(parsed.webUrl);
  return { ok: true, message: "GitHubを開きました。" };
}

async function unregisterProject(projectId) {
  const project = await findProject(projectId);
  const settings = await getSettings();

  await removeProject(app.getPath("userData"), settings.projectsRoot, project.id);

  return {
    ok: true,
    message: project.name + " をHubから外しました。PC上のFileは削除していません。",
    state: await getState()
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 790,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: "#0a0e13",
    show: false,
    title: "Game Dev Hub",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(rendererPath);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.elitemay.gamedevhub");

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  registerIpc("hub:get-state", getState);
  registerIpc("hub:choose-godot", chooseGodot);
  registerIpc("hub:add-github-project", addGitHubProject);
  registerIpc("hub:import-existing-project", importExistingProject);
  registerIpc("hub:start-development", startDevelopment);
  registerIpc("hub:sync-project", syncSelected);
  registerIpc("hub:open-editor", openEditor);
  registerIpc("hub:run-game", runGame);
  registerIpc("hub:open-folder", openFolder);
  registerIpc("hub:open-github", openGitHub);
  registerIpc("hub:remove-project", unregisterProject);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
