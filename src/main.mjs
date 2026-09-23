import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  net,
  screen,
  session,
  shell
} from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createProjectRecord, parseGitHubRepositoryUrl } from "./core/project-model.mjs";
import { detectGodot, inspectSelectedGodot, openGodotEditor, runGodotProject } from "./services/godot.mjs";
import { addProject, loadProjects, removeProject, saveProjects } from "./services/project-registry.mjs";
import { HubError, inspectGit, inspectRepository, prepareProject, syncProject } from "./services/repository.mjs";
import { loadSettings, saveSettings } from "./services/settings.mjs";
import {
  appendFoundationLog,
  clearFoundationLogs,
  foundationDataPath,
  migrateLegacyUserData,
  readRecentFoundationLogs,
  redactHomePath,
  resolveWindowPlacement
} from "./services/desktop-foundation.mjs";
import updaterPackage from "electron-updater";

const { autoUpdater } = updaterPackage;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererPath = path.join(__dirname, "renderer", "index.html");
const trustedRendererUrl = pathToFileURL(rendererPath).toString();

const APP_ID = "com.elitemay.gamedevhub";
const singleInstanceLock = app.requestSingleInstanceLock();

let mainWindow;
let foundationDataRoot = "";
let logsPath = "";
let lastError = null;
let recoveryDialogOpen = false;
let windowStateSaveTimer = null;

const UPDATE_RELEASES_URL = "https://github.com/EliteMay/game-dev-hub/releases/latest";
let updateState = {
  status: "idle",
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: null,
  message: "更新を確認できます。"
};

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:update-state", updateState);

    if (updateState.status === "downloading" && Number.isFinite(updateState.percent)) {
      mainWindow.setProgressBar(Math.max(0, Math.min(1, updateState.percent / 100)));
    } else if (updateState.status !== "checking") {
      mainWindow.setProgressBar(-1);
    }
  }

  return updateState;
}

function appDataRoot() {
  return foundationDataRoot || foundationDataPath(app.getPath("userData"));
}

async function writeFoundationLog(event, options = {}) {
  if (!logsPath) return;

  try {
    await appendFoundationLog(logsPath, {
      event,
      level: options.level,
      code: options.code,
      details: options.details
    });
  } catch {
    // Diagnostics must never make the primary app flow fail.
  }
}

function recordFailure(event, code) {
  lastError = {
    at: new Date().toISOString(),
    event,
    code
  };

  void writeFoundationLog(event, {
    level: "error",
    code
  });
}

function requireNetwork() {
  if (!net.isOnline()) {
    throw new HubError(
      "OFFLINE",
      "インターネットに接続されていません。GitHub同期は使えませんが、Godotで開く・ゲーム起動・フォルダ表示などのローカル操作は利用できます。"
    );
  }
}

function configureUpdater() {
  if (!app.isPackaged) {
    publishUpdateState({ status: "unsupported", message: "開発モードでは自動更新を実行しません。" });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    publishUpdateState({ status: "checking", message: "新しいバージョンを確認しています。", percent: null });
    void writeFoundationLog("update.checking");
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateState({
      status: "available",
      availableVersion: info.version,
      message: "v" + info.version + " を利用できます。",
      percent: null
    });
    void writeFoundationLog("update.available", { details: { version: info.version } });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateState({ status: "not-available", availableVersion: null, message: "最新版です。", percent: null });
    void writeFoundationLog("update.current");
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
    publishUpdateState({ status: "downloading", percent, message: "更新をダウンロード中: " + percent + "%" });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({
      status: "downloaded",
      availableVersion: info.version,
      percent: 100,
      message: "v" + info.version + " の準備ができました。再起動すると更新します。"
    });
    void writeFoundationLog("update.downloaded", { details: { version: info.version } });
  });
  autoUpdater.on("error", (error) => {
    publishUpdateState({
      status: "error",
      percent: null,
      message: "自動更新に失敗しました。ネット接続を確認して再試行するか、手動更新を利用してください。"
    });
    recordFailure("update.error", "UPDATE_ERROR");
  });
}

async function checkForUpdates() {
  if (!net.isOnline()) {
    return {
      ok: false,
      code: "OFFLINE",
      message: "インターネットに接続されていません。ローカル機能はそのまま利用できます。",
      state: publishUpdateState({
        status: "offline",
        percent: null,
        message: "オフラインです。ローカル機能は利用できます。"
      })
    };
  }

  if (!app.isPackaged) {
    return { ok: false, code: "DEV_MODE", state: publishUpdateState({ status: "unsupported", message: "開発モードでは自動更新を実行しません。" }) };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, state: updateState };
  } catch {
    recordFailure("update.check", "UPDATE_CHECK_FAILED");
    return {
      ok: false,
      code: "UPDATE_CHECK_FAILED",
      message: "更新確認に失敗しました。ネット接続を確認して再試行するか、手動更新を利用してください。",
      state: updateState
    };
  }
}

async function downloadUpdate() {
  if (!net.isOnline()) {
    return {
      ok: false,
      code: "OFFLINE",
      message: "インターネットに接続されていません。",
      state: publishUpdateState({
        status: "offline",
        percent: null,
        message: "オフラインです。ローカル機能は利用できます。"
      })
    };
  }

  if (updateState.status !== "available") {
    return { ok: false, code: "UPDATE_NOT_READY", message: "先に更新を確認してください。", state: updateState };
  }
  await autoUpdater.downloadUpdate();
  return { ok: true, state: updateState };
}

function installUpdate() {
  if (updateState.status !== "downloaded") {
    return { ok: false, code: "UPDATE_NOT_DOWNLOADED", message: "更新のダウンロードが完了していません。", state: updateState };
  }
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true, state: updateState };
}

async function openUpdatePage() {
  await shell.openExternal(UPDATE_RELEASES_URL);
  return { ok: true };
}

function defaultProjectsRoot() {
  return path.join(app.getPath("documents"), "Game Dev Hub");
}

function defaultWindowState() {
  return {
    width: 1240,
    height: 790,
    x: null,
    y: null,
    maximized: false
  };
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
    message: "処理に失敗しました。診断情報またはログを確認してください。"
  };
}

const LOGGED_IPC_CHANNELS = new Set([
  "hub:choose-godot",
  "hub:add-github-project",
  "hub:import-existing-project",
  "hub:start-development",
  "hub:sync-project",
  "hub:open-editor",
  "hub:run-game",
  "hub:remove-project",
  "hub:update-check",
  "hub:update-download",
  "hub:update-install",
  "hub:diagnostics-export",
  "hub:diagnostics-clear-logs"
]);

function registerIpc(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    const shouldLog = LOGGED_IPC_CHANNELS.has(channel);

    if (shouldLog) {
      void writeFoundationLog("ipc.start", { details: { channel } });
    }

    try {
      const result = await handler(payload);

      if (shouldLog) {
        void writeFoundationLog("ipc.finish", {
          level: result?.ok === false ? "warning" : "info",
          code: result?.code,
          details: { channel, ok: result?.ok !== false }
        });
      }

      return result;
    } catch (error) {
      const safe = safeError(error);
      recordFailure("ipc.failure", safe.code);
      return {
        ok: false,
        ...safe
      };
    }
  });
}

async function getSettings() {
  return loadSettings(appDataRoot(), {
    projectsRoot: defaultProjectsRoot(),
    window: defaultWindowState()
  });
}

async function updateSettings(patch) {
  const current = await getSettings();
  return saveSettings(
    appDataRoot(),
    { ...current, ...patch },
    { projectsRoot: defaultProjectsRoot(), window: defaultWindowState() }
  );
}

async function getRegistry() {
  const settings = await getSettings();
  return loadProjects(appDataRoot(), settings.projectsRoot);
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
    update: updateState,
    network: {
      online: net.isOnline()
    },
    settings: {
      projectsRoot: settings.projectsRoot,
      lastSelectedProjectId: settings.lastSelectedProjectId
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
    appDataRoot(),
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

  let defaultBranch = "main";

  try {
    const remoteHead = (await runFile(
      "git",
      ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
      { cwd: localPath, timeout: 10_000 }
    )).stdout;

    defaultBranch = remoteHead.replace(/^origin\//, "") || "main";
  } catch {
    try {
      defaultBranch = (await runFile(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: localPath, timeout: 10_000 }
      )).stdout || "main";
    } catch {
      defaultBranch = "main";
    }
  }

  const settings = await getSettings();
  const registry = await getRegistry();
  const existing = registry.projects.find(
    (item) => item.repositoryWebUrl.toLowerCase() === parsed.webUrl.toLowerCase()
  );

  if (existing) {
    const updatedProject = createProjectRecord({
      ...existing,
      localPath,
      defaultBranch
    });

    await saveProjects(appDataRoot(), {
      version: registry.version,
      projects: registry.projects.map((item) =>
        item.id === existing.id ? updatedProject : item
      )
    });

    return {
      ok: true,
      message: updatedProject.name + " のLocal folderを更新しました。",
      projectId: updatedProject.id,
      state: await getState()
    };
  }

  const project = await addProject(
    appDataRoot(),
    settings.projectsRoot,
    {
      name: parsed.repo,
      repositoryUrl: parsed.cloneUrl,
      localPath,
      defaultBranch,
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
  requireNetwork();
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
  requireNetwork();
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

async function setSelectedProject(projectId) {
  if (projectId === null || projectId === "") {
    await updateSettings({ lastSelectedProjectId: "" });
    return { ok: true };
  }

  const project = await findProject(projectId);
  await updateSettings({ lastSelectedProjectId: project.id });
  return { ok: true };
}

async function diagnosticsSnapshot() {
  const settings = await getSettings();
  const registry = await getRegistry();
  const git = await inspectGit();
  const godot = await detectGodot(settings.godotPath);
  const homePath = app.getPath("home");

  return {
    capturedAt: new Date().toISOString(),
    app: {
      name: "Game Dev Hub",
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      platformRelease: os.release(),
      arch: process.arch,
      packaged: app.isPackaged
    },
    update: {
      channel: "stable",
      status: updateState.status,
      availableVersion: updateState.availableVersion || null
    },
    network: {
      online: net.isOnline()
    },
    storage: {
      settingsVersion: settings.version,
      dataPath: redactHomePath(appDataRoot(), homePath),
      logsPath: redactHomePath(logsPath, homePath),
      projectsRoot: redactHomePath(settings.projectsRoot, homePath)
    },
    capabilities: {
      git: git.available === true,
      godot: godot.available === true
    },
    projectCount: registry.projects.length,
    lastError,
    recentLogs: await readRecentFoundationLogs(logsPath, 60)
  };
}

async function getDiagnostics() {
  return {
    ok: true,
    diagnostics: await diagnosticsSnapshot()
  };
}

async function exportDiagnostics() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "診断情報を書き出す",
    defaultPath: path.join(
      app.getPath("documents"),
      "game-dev-hub-diagnostics-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json"
    ),
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, code: "CANCELED", message: "書き出しをキャンセルしました。" };
  }

  const diagnostics = await diagnosticsSnapshot();
  await fs.writeFile(result.filePath, JSON.stringify(diagnostics, null, 2) + "\n", "utf8");
  return { ok: true, message: "診断情報を書き出しました。" };
}

async function openLogsFolder() {
  const errorMessage = await shell.openPath(logsPath);
  if (errorMessage) {
    throw new HubError("OPEN_LOGS_FAILED", "ログフォルダを開けませんでした。");
  }
  return { ok: true, message: "ログフォルダを開きました。" };
}

async function clearDiagnosticLogs() {
  await clearFoundationLogs(logsPath);
  await writeFoundationLog("diagnostics.logs-cleared");
  return { ok: true, message: "診断ログを消去しました。" };
}

async function unregisterProject(projectId) {
  const project = await findProject(projectId);
  const settings = await getSettings();

  await removeProject(appDataRoot(), settings.projectsRoot, project.id);

  return {
    ok: true,
    message: project.name + " をHubから外しました。PC上のFileは削除していません。",
    state: await getState()
  };
}

async function persistWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getNormalBounds();
  await updateSettings({
    window: {
      ...bounds,
      maximized: mainWindow.isMaximized()
    }
  });
}

function scheduleWindowStateSave() {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => {
    persistWindowState().catch(() => {
      recordFailure("window.state-save", "WINDOW_STATE_SAVE_FAILED");
    });
  }, 300);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function attachWindowRecovery(window) {
  window.webContents.on("render-process-gone", (_event, details) => {
    recordFailure("renderer.gone", "RENDER_PROCESS_GONE");
    void writeFoundationLog("renderer.gone", {
      level: "error",
      code: "RENDER_PROCESS_GONE",
      details: {
        reason: details.reason,
        exitCode: details.exitCode
      }
    });

    if (recoveryDialogOpen) return;
    recoveryDialogOpen = true;

    setTimeout(async () => {
      try {
        const result = await dialog.showMessageBox(window, {
          type: "error",
          title: "Game Dev Hubの画面が停止しました",
          message: "画面のプロセスが停止しました。保存済みの設定やゲーム登録は保持されています。",
          detail: "画面を再読み込みして復旧できます。繰り返し発生する場合は「診断」から診断情報を書き出してください。",
          buttons: ["画面を再読み込み", "アプリを終了"],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });

        if (result.response === 0 && !window.isDestroyed()) {
          window.reload();
        } else {
          app.quit();
        }
      } finally {
        recoveryDialogOpen = false;
      }
    }, 0);
  });

  window.webContents.on("unresponsive", () => {
    void writeFoundationLog("renderer.unresponsive", {
      level: "warning",
      code: "RENDERER_UNRESPONSIVE"
    });
  });

  window.webContents.on("responsive", () => {
    void writeFoundationLog("renderer.responsive");
  });
}

async function createWindow() {
  const settings = await getSettings();
  const saved = settings.window || defaultWindowState();
  const display = Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? screen.getDisplayMatching({
        x: saved.x,
        y: saved.y,
        width: saved.width,
        height: saved.height
      })
    : screen.getPrimaryDisplay();

  const placement = resolveWindowPlacement(saved, display.workArea);

  mainWindow = new BrowserWindow({
    ...placement,
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

  if (process.platform === "win32" && app.isPackaged) {
    mainWindow.setAppDetails({
      appId: APP_ID,
      appIconPath: process.execPath,
      appIconIndex: 0
    });
  }

  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => {
    if (saved.maximized) mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.on("maximize", scheduleWindowStateSave);
  mainWindow.on("unmaximize", scheduleWindowStateSave);
  mainWindow.on("closed", () => {
    clearTimeout(windowStateSaveTimer);
    mainWindow = null;
  });

  attachWindowRecovery(mainWindow);
  await mainWindow.loadFile(rendererPath);
}

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
    void writeFoundationLog("app.second-instance");
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    nativeTheme.themeSource = "dark";
    app.setAppLogsPath();
    logsPath = app.getPath("logs");

    const migration = await migrateLegacyUserData(app.getPath("userData"));
    foundationDataRoot = migration.dataPath;

    await writeFoundationLog("app.start", {
      details: {
        version: app.getVersion(),
        packaged: app.isPackaged,
        migratedFiles: migration.copied.length
      }
    });

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
    registerIpc("hub:set-selected-project", setSelectedProject);
    registerIpc("hub:get-diagnostics", getDiagnostics);
    registerIpc("hub:diagnostics-export", exportDiagnostics);
    registerIpc("hub:diagnostics-open-logs", openLogsFolder);
    registerIpc("hub:diagnostics-clear-logs", clearDiagnosticLogs);
    registerIpc("hub:update-check", checkForUpdates);
    registerIpc("hub:update-download", downloadUpdate);
    registerIpc("hub:update-install", installUpdate);
    registerIpc("hub:update-open-release", openUpdatePage);

    configureUpdater();
    await createWindow();

    setTimeout(() => {
      if (app.isPackaged) checkForUpdates().catch(() => {});
    }, 2500);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(() => {
          recordFailure("window.create", "WINDOW_CREATE_FAILED");
        });
      }
    });
  }).catch(() => {
    recordFailure("app.startup", "APP_STARTUP_FAILED");
    app.quit();
  });
}

app.on("before-quit", () => {
  void persistWindowState();
  void writeFoundationLog("app.quit");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
