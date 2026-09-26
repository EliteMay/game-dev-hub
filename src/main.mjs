import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
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
import {
  bootstrapFoundationProject,
  inspectFoundationInstallation,
  updateProjectFoundation as updateManagedFoundationProject
} from "./services/foundation-template.mjs";
import { HubError, inspectGit, inspectRepository, prepareProject, saveRepositoryChanges, syncProject } from "./services/repository.mjs";
import { loadSettings, saveSettings } from "./services/settings.mjs";
import {
  clearTaskVerification,
  loadTaskVerifications,
  saveTaskVerification
} from "./services/task-verification.mjs";
import {
  appendFoundationLog,
  clearFoundationLogs,
  foundationDataPath,
  migrateLegacyUserData,
  readRecentFoundationLogs,
  redactHomePath,
  resolveWindowPlacement
} from "./services/desktop-foundation.mjs";
import {
  addReferenceImages,
  copyReferenceImages,
  listReferenceImages,
  loadDevelopmentTasks,
  referenceImagePath,
  removeReferenceImage
} from "./services/development-workspace.mjs";
import {
  copyLatestAutoTestForPack,
  diagnoseAutoTest,
  getActiveAutoTestState,
  listAutoTestRuns,
  loadAutoTestConfig,
  loadLatestAutoTestReport,
  runAutoTests,
  saveAutoTestConfig,
  stopActiveAutoTest
} from "./services/auto-test.mjs";
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
  "hub:create-foundation-project",
  "hub:update-project-foundation",
  "hub:import-existing-project",
  "hub:start-development",
  "hub:sync-project",
  "hub:save-repository-changes",
  "hub:open-editor",
  "hub:run-game",
  "hub:remove-project",
  "hub:update-check",
  "hub:update-download",
  "hub:update-install",
  "hub:diagnostics-export",
  "hub:diagnostics-clear-logs",
  "hub:set-active-task",
  "hub:task-verification-save",
  "hub:task-verification-clear",
  "hub:reference-images-add",
  "hub:reference-image-remove",
  "hub:chatgpt-pack-export",
  "hub:auto-test-choose-exe",
  "hub:auto-test-save-config",
  "hub:auto-test-diagnose",
  "hub:auto-test-start",
  "hub:auto-test-retest-failed",
  "hub:auto-test-stop",
  "hub:auto-test-open-folder"
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

    const foundation = repository.exists
      ? await inspectFoundationInstallation(project.localPath)
      : {
          installed: false,
          valid: false,
          version: "",
          commit: "",
          managedPaths: []
        };

    const developmentTasks = repository.exists
      ? await loadDevelopmentTasks(project)
      : {
          available: false,
          sourceFile: "",
          sections: [],
          total: 0,
          done: 0,
          open: 0,
          currentSection: "",
          nextTask: null
        };

    const taskVerifications = repository.exists
      ? await loadTaskVerifications(appDataRoot(), project.id, developmentTasks)
      : {};

    projects.push({
      ...project,
      repository,
      foundation,
      development: {
        tasks: developmentTasks,
        activeTaskId: settings.activeTaskByProject?.[project.id] || "",
        verifications: taskVerifications
      }
    });
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
    autoTest: getActiveAutoTestState(),
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

async function createFoundationProject(payload) {
  requireNetwork();

  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "新しいGameの指定が正しくありません。");
  }

  const parsed = parseGitHubRepositoryUrl(payload.repositoryUrl);
  if (!parsed) {
    throw new HubError(
      "INVALID_REPOSITORY_URL",
      "空のGitHub Repository URLを https://github.com/owner/repository の形で入力してください。"
    );
  }

  const settings = await getSettings();
  const registry = await getRegistry();
  const duplicate = registry.projects.find(
    (item) => item.repositoryWebUrl.toLowerCase() === parsed.webUrl.toLowerCase()
  );

  if (duplicate) {
    throw new HubError("PROJECT_ALREADY_REGISTERED", "このRepositoryはすでにHubへ登録されています。");
  }

  const project = createProjectRecord({
    name: String(payload.name ?? "").trim() || parsed.repo,
    repositoryUrl: parsed.cloneUrl,
    localPath: path.join(settings.projectsRoot, parsed.repo),
    defaultBranch: "main",
    engine: "godot"
  });

  const generated = await bootstrapFoundationProject(project, appDataRoot());

  await addProject(
    appDataRoot(),
    settings.projectsRoot,
    project
  );

  return {
    ok: true,
    message:
      project.name +
      " をGodot Game Foundation " +
      generated.metadata.foundationVersion +
      " から作成してGitHubへ保存しました。",
    projectId: project.id,
    foundation: generated.metadata,
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

async function updateSelectedFoundation(projectId) {
  requireNetwork();

  const project = await findProject(projectId);
  const repository = await inspectRepository(project);

  if (!repository.valid) {
    throw new HubError(
      "REPOSITORY_INVALID",
      "Foundation更新前にLocal Repositoryを正しい状態へ準備してください。"
    );
  }

  if (repository.dirty) {
    throw new HubError(
      "DIRTY_WORKTREE",
      "PC側に未保存の変更があります。先に「GitHubに保存」するか、変更を確認してからFoundationを更新してください。"
    );
  }

  if (repository.branch !== project.defaultBranch) {
    throw new HubError(
      "WRONG_BRANCH",
      "現在のBranchが " + project.defaultBranch + " ではないためFoundation更新を停止しました。"
    );
  }

  if ((repository.ahead || 0) > 0) {
    throw new HubError(
      "UNPUSHED_COMMITS",
      "GitHubへの送信待ちがあります。先に「GitHubに保存」を完了してからFoundationを更新してください。"
    );
  }

  await syncProject(project);
  const updated = await updateManagedFoundationProject(project, appDataRoot());

  return {
    ok: true,
    message: updated.changed
      ? "Foundationを " + updated.foundationVersion + " へ更新しました。Game固有Fileは変更していません。内容を確認して「GitHubに保存」してください。"
      : "Foundationはすでに最新版です。",
    foundation: updated,
    state: await getState()
  };
}


async function saveSelectedRepositoryChanges(payload) {
  requireNetwork();

  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "GitHubへ保存する内容の指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const commitMessage =
    typeof payload.message === "string" ? payload.message : "";

  const result = await saveRepositoryChanges(project, commitMessage);

  return {
    ok: true,
    message: result.message,
    commit: result.commit,
    mergedRemote: result.mergedRemote === true,
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


function publishAutoTestProgress(progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:auto-test-progress", progress);
  }
}

async function getAutoTestState(projectId) {
  const project = await findProject(projectId);
  const [config, history, latest] = await Promise.all([
    loadAutoTestConfig(appDataRoot(), project.id),
    listAutoTestRuns(appDataRoot(), project.id),
    loadLatestAutoTestReport(appDataRoot(), project.id)
  ]);
  return {
    ok: true,
    project: { id: project.id, name: project.name },
    config,
    history,
    latest,
    active: getActiveAutoTestState()
  };
}

async function chooseAutoTestExe(projectId) {
  const project = await findProject(projectId);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: project.name + " のテスト対象exeを選ぶ",
    properties: ["openFile"],
    filters: [{ name: "Windowsアプリ", extensions: ["exe"] }]
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, code: "CANCELED", message: "exe選択をキャンセルしました。" };
  }
  return { ok: true, exePath: path.normalize(result.filePaths[0]) };
}

async function saveAutoTestConfigAction(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "自動テスト設定が正しくありません。");
  }
  const project = await findProject(payload.projectId);
  const config = await saveAutoTestConfig(appDataRoot(), project.id, payload.config || {});
  return { ok: true, message: "自動テスト設定を保存しました。", config };
}

async function diagnoseProjectAutoTest(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "自動テスト診断の指定が正しくありません。");
  }
  const project = await findProject(payload.projectId);
  const saved = await loadAutoTestConfig(appDataRoot(), project.id);
  const config = payload.config && typeof payload.config === "object"
    ? { ...saved, ...payload.config, model: { ...saved.model, ...(payload.config.model || {}) } }
    : saved;
  const diagnostics = await diagnoseAutoTest({
    config,
    apiKey: typeof payload.apiKey === "string" ? payload.apiKey.slice(0, 2000) : ""
  });
  return { ok: true, diagnostics };
}

async function executeProjectAutoTest(payload, failedOnly = false) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "自動テストの指定が正しくありません。");
  }
  const project = await findProject(payload.projectId);
  const repository = await inspectRepository(project);
  if (!repository.valid) {
    throw new HubError("REPOSITORY_INVALID", "Local Repositoryを先に準備してください。");
  }

  const config = await saveAutoTestConfig(appDataRoot(), project.id, payload.config || {});
  let onlyTestIds = null;
  if (failedOnly) {
    const latest = await loadLatestAutoTestReport(appDataRoot(), project.id);
    onlyTestIds = (latest?.tests || [])
      .filter((test) => test.status === "FAIL")
      .map((test) => test.id);
    if (!onlyTestIds.length) {
      return { ok: false, code: "NO_FAILED_TESTS", message: "前回FAILしたテストはありません。" };
    }
  }

  const result = await runAutoTests({
    userDataPath: appDataRoot(),
    project,
    config,
    apiKey: typeof payload.apiKey === "string" ? payload.apiKey.slice(0, 2000) : "",
    gitCommit: repository.commit || "",
    appVersion: app.getVersion(),
    onlyTestIds,
    onProgress: publishAutoTestProgress
  });

  return {
    ok: true,
    message: failedOnly ? "失敗項目の再テストが完了しました。" : "AI自動テストが完了しました。",
    report: result.report,
    summary: result.summary,
    autoTestState: await getAutoTestState(project.id)
  };
}

async function startProjectAutoTest(payload) {
  return executeProjectAutoTest(payload, false);
}

async function retestFailedProjectAutoTests(payload) {
  return executeProjectAutoTest(payload, true);
}

async function stopProjectAutoTest() {
  const stopped = await stopActiveAutoTest("emergency-button");
  publishAutoTestProgress({
    phase: stopped ? "stopped" : "idle",
    message: stopped ? "AI操作を緊急停止しました。" : "実行中のAIテストはありません。",
    lastAction: ""
  });
  return { ok: true, stopped, message: stopped ? "AI操作を緊急停止しました。" : "実行中のAIテストはありません。" };
}

async function openAutoTestFolder(projectId) {
  const project = await findProject(projectId);
  const folder = path.join(appDataRoot(), "auto-tests", project.id);
  await fs.mkdir(folder, { recursive: true });
  const errorMessage = await shell.openPath(folder);
  if (errorMessage) throw new HubError("OPEN_FOLDER_FAILED", "自動テスト保存先を開けませんでした。");
  return { ok: true };
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

function flattenTasks(tasks) {
  return (tasks?.sections || []).flatMap((section) =>
    section.tasks.map((task) => ({
      ...task,
      section: section.title,
      completionCriteria: section.completionCriteria || ""
    }))
  );
}

async function setActiveTask(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "今やるタスクの指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
  const tasks = await loadDevelopmentTasks(project);

  if (taskId && !flattenTasks(tasks).some((task) => task.id === taskId && !task.done)) {
    throw new HubError("TASK_NOT_FOUND", "そのタスクは現在のRoadmapにありません。Repositoryを更新して再確認してください。");
  }

  const settings = await getSettings();
  await updateSettings({
    activeTaskByProject: {
      ...(settings.activeTaskByProject || {}),
      [project.id]: taskId
    }
  });

  return { ok: true, taskId };
}


async function saveManualTaskVerification(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "確認結果の指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
  const tasks = await loadDevelopmentTasks(project);
  const task = flattenTasks(tasks).find((candidate) => candidate.id === taskId && !candidate.done);

  if (!task) {
    throw new HubError("TASK_NOT_FOUND", "そのタスクは現在のRoadmapにありません。最新版にして再確認してください。");
  }

  if (task.owner !== "user") {
    throw new HubError("TASK_OWNER_MISMATCH", "この確認結果は「担当: あなた」のタスクだけに保存できます。");
  }

  const repository = await inspectRepository(project);
  const settings = await getSettings();
  const godot = await detectGodot(settings.godotPath);

  const verification = await saveTaskVerification(
    appDataRoot(),
    project.id,
    task,
    payload,
    {
      repositoryCommit: repository.commit || "",
      repositoryBranch: repository.branch || "",
      godotVersion: godot.version || "",
      appVersion: app.getVersion()
    }
  );

  const message =
    verification.overall === "passed" ? "確認結果を保存しました。すべて「できた」です。" :
    verification.overall === "failed" ? "確認結果を保存しました。「できなかった」項目があります。" :
    verification.overall === "blocked" ? "確認結果を保存しました。「今は確認できない」項目があります。" :
    "確認途中の結果を保存しました。";

  return {
    ok: true,
    message,
    verification,
    state: await getState()
  };
}

async function clearManualTaskVerification(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "確認結果の指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const taskId = typeof payload.taskId === "string" ? payload.taskId : "";

  if (!taskId) {
    throw new HubError("INVALID_INPUT", "確認結果を消すタスクが指定されていません。");
  }

  await clearTaskVerification(appDataRoot(), project.id, taskId);

  return {
    ok: true,
    message: "このタスクの確認結果をリセットしました。",
    state: await getState()
  };
}

async function referenceImagesState(projectId) {
  const project = await findProject(projectId);
  const items = await listReferenceImages(appDataRoot(), project.id);

  const images = items.map((item) => {
    let thumbnail = "";
    try {
      const image = nativeImage.createFromPath(item.filePath);
      if (!image.isEmpty()) {
        thumbnail = image.resize({ width: 220, quality: "good" }).toDataURL();
      }
    } catch {
      thumbnail = "";
    }

    return {
      id: item.id,
      displayName: item.displayName,
      size: item.size,
      updatedAt: item.updatedAt,
      thumbnail
    };
  });

  return { ok: true, images };
}

async function addProjectReferenceImages(projectId) {
  const project = await findProject(projectId);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: project.name + " の参考画像を追加",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "画像", extensions: ["png", "jpg", "jpeg", "webp"] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { ok: false, code: "CANCELED", message: "画像追加をキャンセルしました。" };
  }

  const added = await addReferenceImages(appDataRoot(), project.id, result.filePaths);
  const state = await referenceImagesState(project.id);

  return {
    ok: true,
    message: added.accepted.length + "枚の参考画像を追加しました。" +
      (added.skipped.length ? " " + added.skipped.length + "枚は形式または容量の条件で追加できませんでした。" : ""),
    images: state.images
  };
}

async function removeProjectReferenceImage(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "画像の指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  await removeReferenceImage(appDataRoot(), project.id, payload.imageId);
  const state = await referenceImagesState(project.id);
  return { ok: true, message: "参考画像を外しました。元の画像Fileは削除していません。", images: state.images };
}

async function openProjectReferenceImage(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "画像の指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const filePath = referenceImagePath(appDataRoot(), project.id, payload.imageId);
  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) {
    throw new HubError("OPEN_IMAGE_FAILED", "参考画像を開けませんでした。");
  }
  return { ok: true };
}

function safeFolderPart(value) {
  return String(value || "game")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "game";
}

async function exportChatGptPack(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HubError("INVALID_INPUT", "ChatGPT共有パックの指定が正しくありません。");
  }

  const project = await findProject(payload.projectId);
  const repository = await inspectRepository(project);
  const tasks = await loadDevelopmentTasks(project);
  const settings = await getSettings();
  const requestedTaskId = typeof payload.taskId === "string" ? payload.taskId : "";
  const activeTaskId = requestedTaskId || settings.activeTaskByProject?.[project.id] || "";
  const allTasks = flattenTasks(tasks);
  const activeTask =
    allTasks.find((task) => task.id === activeTaskId && !task.done) ||
    tasks.nextTask ||
    null;
  const taskVerifications = await loadTaskVerifications(appDataRoot(), project.id, tasks);
  const activeVerification = activeTask
    ? taskVerifications[activeTask.id] || null
    : null;
  const allUserTaskResults = allTasks
    .filter((task) => task.owner === "user")
    .map((task) => ({
      taskId: task.id,
      section: task.section,
      text: task.text,
      doneInRoadmap: task.done === true,
      completionCriteria: task.completionCriteria || "",
      result: taskVerifications[task.id] || null
    }));

  const verificationSummary = {
    totalUserTasks: allUserTaskResults.length,
    completed: allUserTaskResults.filter((item) => item.doneInRoadmap).length,
    open: allUserTaskResults.filter((item) => !item.doneInRoadmap).length,
    recorded: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result && item.result.overall !== "untested"
    ).length,
    passed: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result?.overall === "passed"
    ).length,
    failed: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result?.overall === "failed"
    ).length,
    blocked: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result?.overall === "blocked"
    ).length,
    inProgress: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result?.overall === "in-progress"
    ).length,
    stale: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && item.result?.overall === "stale"
    ).length,
    untested: allUserTaskResults.filter(
      (item) => !item.doneInRoadmap && (!item.result || item.result.overall === "untested")
    ).length
  };

  const capturedAt = new Date();
  const stamp = capturedAt.toISOString().replace(/[:.]/g, "-");
  const packRoot = path.join(
    appDataRoot(),
    "chatgpt-packs",
    safeFolderPart(project.name) + "-" + stamp
  );
  await fs.mkdir(packRoot, { recursive: true });

  const screenshotFile = "hub-screenshot.png";
  if (mainWindow && !mainWindow.isDestroyed()) {
    const image = await mainWindow.webContents.capturePage();
    await fs.writeFile(path.join(packRoot, screenshotFile), image.toPNG());
  }

  const referenceImages = await copyReferenceImages(appDataRoot(), project.id, packRoot);
  const autoTest = await copyLatestAutoTestForPack(appDataRoot(), project.id, packRoot);
  const diagnostics = await diagnosticsSnapshot();
  const homePath = app.getPath("home");

  const pack = {
    schemaVersion: 3,
    kind: "game-dev-hub-chatgpt-pack",
    capturedAt: capturedAt.toISOString(),
    purpose: "このゲームで保存したUser実機確認結果を全部まとめ、現在のGame開発状態と一緒にChatGPTへ共有する。",
    app: {
      name: "Game Dev Hub",
      version: app.getVersion()
    },
    project: {
      name: project.name,
      repository: project.repositorySlug,
      repositoryUrl: project.repositoryWebUrl,
      defaultBranch: project.defaultBranch,
      localPath: redactHomePath(project.localPath, homePath)
    },
    repository: {
      exists: repository.exists,
      valid: repository.valid,
      branch: repository.branch,
      commit: repository.commit,
      dirty: repository.dirty,
      changedCount: repository.changedCount,
      changedFiles: repository.changedFiles,
      ahead: repository.ahead,
      behind: repository.behind
    },
    roadmap: tasks,
    activeTask,
    handoff: {
      goal: "Game内のUser実機確認結果をまとめて評価し、Current TaskとRepositoryを前へ進める。",
      chatgptAction:
        "GitHub Repositoryと共有情報だけで完了できる作業は、説明だけで終わらせずChatGPTがそのままRepositoryへ反映する。必要な文書更新やTask完了更新も含む。",
      userAction:
        "Windows実機操作、Godot上での目視確認、プレイ結果などUserにしか確認できない作業だけをUserへ依頼する。",
      clarificationPolicy:
        "共有情報とRepositoryから合理的に判断できる内容はUserへ聞き返さず進める。"
    },
    verification: {
      source: "Game Dev Hub runtime snapshot",
      note: "Gameの実プレイ結果はUserがHubで選択した確認結果、画像、User messageをEvidenceとして判断する。",
      summary: verificationSummary,
      allUserTaskResults,
      activeTaskResult: activeVerification
    },
    autoTest: autoTest
      ? {
          source: "Game Dev Hub UI-TARS automated Windows playtest",
          summary: autoTest.summary,
          reportFile: autoTest.report,
          evidenceFiles: autoTest.evidence
        }
      : null,
    diagnostics: {
      network: diagnostics.network,
      capabilities: diagnostics.capabilities,
      toolchain: diagnostics.toolchain,
      lastError: diagnostics.lastError,
      recentLogs: diagnostics.recentLogs
    },
    files: {
      hubScreenshot: screenshotFile,
      referenceImages,
      autoTestReport: autoTest?.report || "",
      autoTestEvidence: autoTest?.evidence || []
    },
    privacy: {
      automaticSecretsIncluded: false,
      userEnteredVerificationNoteIncluded: allUserTaskResults.some((item) => Boolean(item.result?.note)),
      sourceFileContentsIncluded: false,
      homePathRedacted: true,
      note: "HubはToken/Secretを自動収集しません。ただしUserが確認メモへ入力した文字列はそのまま共有パックへ含まれます。"
    }
  };

  await fs.writeFile(
    path.join(packRoot, "game-dev-hub-report.json"),
    JSON.stringify(pack, null, 2) + "\n",
    "utf8"
  );

  const verificationStatusLabel = (status) => {
    if (status === "completed") return "Roadmap完了済み";
    if (status === "passed") return "できた";
    if (status === "failed") return "できなかった項目あり";
    if (status === "blocked") return "確認できない項目あり";
    if (status === "in-progress") return "確認途中";
    if (status === "stale") return "再確認が必要";
    return "未確認";
  };

  const verificationStepStatusLabel = (status) => {
    if (status === "passed") return "できた";
    if (status === "failed") return "できなかった";
    if (status === "blocked") return "今は確認できない";
    return "未選択";
  };

  const verificationLines = allUserTaskResults.map((item) => {
    const status = item.doneInRoadmap
      ? "Roadmap完了済み（再確認不要）"
      : verificationStatusLabel(item.result?.overall || "untested");
    const note = item.result?.note ? " / メモ: " + item.result.note : "";
    const steps = !item.doneInRoadmap && item.result?.steps?.length
      ? " / " + item.result.steps.map((step) => verificationStepStatusLabel(step.status)).join(", ")
      : "";
    return "- " + item.section + " / " + item.text + ": " + status + steps + note;
  });

  const promptLines = [
    "この共有パックは、このゲームで保存した実機確認結果を全部まとめたChatGPT引き継ぎです。",
    "",
    "ChatGPTへの依頼:",
    "- 下の「User実機確認結果」をまとめて確認してください。",
    "- できた結果はEvidenceとして扱い、必要ならRoadmapの完了状態をRepositoryへ反映してください。",
    "- できなかった結果がある場合は、該当TaskのRepository実装を調査して修正してください。",
    "- 確認できない / 再確認が必要な未完了項目は、Userに必要最小限の操作だけ案内してください。",
    "- Roadmapで完了済みの確認Taskは、説明文変更だけを理由に再確認させないでください。",
    "- GitHub Repositoryと共有情報だけで完了できる作業は、手順を説明するだけで終わらせず、そのままRepositoryへ反映してください。",
    "- 必要ならREADME / Roadmap /仕様書など関連文書も実装と一致するよう更新してください。",
    "",
    "User実機確認結果まとめ:",
    verificationLines.length ? verificationLines.join("\n") : "- まだ確認結果はありません。",
    "",
    "AI自動テスト:",
    autoTest
      ? "- " + autoTest.summary.passed + " PASS / " + autoTest.summary.failed + " FAIL / " +
        autoTest.summary.warning + " WARNING / " + autoTest.summary.unknown + " UNKNOWN"
      : "- まだAI自動テスト結果はありません。",
    "",
    activeTask ? "現在選択中のタスク: " + activeTask.section + " / " + activeTask.text : "現在選択中のタスク: 未選択",
    "",
    "確認してほしい内容:",
    "- User実機確認結果をまとめて評価する",
    "- Repository状態とRoadmapを確認する",
    "- 問題があるTaskは原因を調査して修正する",
    "- できたTaskはEvidenceが十分ならRoadmapへ反映する",
    "- 添付画像から確認できる実装・見た目・不具合も確認する",
    "",
    "※ HubはTokenやFile本文を自動収集しません。User確認メモへ入力した文字列はそのままJSONへ入ります。必要なCodeはGitHub RepositoryをSource of Truthとして確認してください。"
  ];
  await fs.writeFile(path.join(packRoot, "CHATGPTに送る.txt"), promptLines.join("\n") + "\n", "utf8");

  const openError = await shell.openPath(packRoot);
  if (openError) {
    void writeFoundationLog("chatgpt-pack.open-folder-failed", {
      level: "warning",
      code: "OPEN_PACK_FOLDER_FAILED"
    });
  }

  return {
    ok: true,
    message: verificationSummary.recorded > 0
      ? verificationSummary.recorded + "件の未完了Task確認結果をまとめたChatGPT共有パックを作成しました。"
      : "現在状態のChatGPT共有パックを作成しました。",
    fileCount: 2 + referenceImages.length + (mainWindow && !mainWindow.isDestroyed() ? 1 : 0) +
      (autoTest ? 1 + autoTest.evidence.length : 0)
  };
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
    toolchain: {
      gitVersion: git.version || "",
      godotVersion: godot.version || ""
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
    registerIpc("hub:create-foundation-project", createFoundationProject);
    registerIpc("hub:update-project-foundation", updateSelectedFoundation);
    registerIpc("hub:import-existing-project", importExistingProject);
    registerIpc("hub:start-development", startDevelopment);
    registerIpc("hub:sync-project", syncSelected);
    registerIpc("hub:save-repository-changes", saveSelectedRepositoryChanges);
    registerIpc("hub:open-editor", openEditor);
    registerIpc("hub:run-game", runGame);
    registerIpc("hub:open-folder", openFolder);
    registerIpc("hub:open-github", openGitHub);
    registerIpc("hub:remove-project", unregisterProject);
    registerIpc("hub:set-selected-project", setSelectedProject);
    registerIpc("hub:set-active-task", setActiveTask);
    registerIpc("hub:task-verification-save", saveManualTaskVerification);
    registerIpc("hub:task-verification-clear", clearManualTaskVerification);
    registerIpc("hub:reference-images-list", referenceImagesState);
    registerIpc("hub:reference-images-add", addProjectReferenceImages);
    registerIpc("hub:reference-image-remove", removeProjectReferenceImage);
    registerIpc("hub:reference-image-open", openProjectReferenceImage);
    registerIpc("hub:chatgpt-pack-export", exportChatGptPack);
    registerIpc("hub:auto-test-get", getAutoTestState);
    registerIpc("hub:auto-test-choose-exe", chooseAutoTestExe);
    registerIpc("hub:auto-test-save-config", saveAutoTestConfigAction);
    registerIpc("hub:auto-test-diagnose", diagnoseProjectAutoTest);
    registerIpc("hub:auto-test-start", startProjectAutoTest);
    registerIpc("hub:auto-test-retest-failed", retestFailedProjectAutoTests);
    registerIpc("hub:auto-test-stop", stopProjectAutoTest);
    registerIpc("hub:auto-test-open-folder", openAutoTestFolder);
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

    const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+F12", () => {
      void stopActiveAutoTest("emergency-shortcut").then((stopped) => {
        if (stopped) {
          publishAutoTestProgress({
            phase: "stopped",
            message: "緊急停止ショートカットでAI操作を停止しました。",
            lastAction: ""
          });
        }
      });
    });
    if (!shortcutRegistered) {
      void writeFoundationLog("auto-test.shortcut-unavailable", {
        level: "warning",
        code: "GLOBAL_SHORTCUT_UNAVAILABLE"
      });
    }

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
  void stopActiveAutoTest("app-quit");
  globalShortcut.unregisterAll();
  void persistWindowState();
  void writeFoundationLog("app.quit");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
