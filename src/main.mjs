import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  nativeTheme,
  net,
  safeStorage,
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
  DEFAULT_AI_TESTS,
  buildReproductionSteps,
  findAndFocusTargetWindow,
  inspectExecutable,
  inspectUiTarsDependencies,
  latestAiTestReport,
  launchTestExecutable,
  listAiTestHistory,
  loadAiTestConfig,
  makeTestRunId,
  runUiTarsTest,
  saveAiTestConfig,
  saveAiTestReport,
  summarizeAiTestResults
} from "./services/ai-testing.mjs";
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
let activeAiTestRun = null;

const AI_TEST_EMERGENCY_SHORTCUT = "CommandOrControl+Shift+F12";
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
  "hub:ai-test-config-save",
  "hub:ai-test-run",
  "hub:ai-test-stop",
  "hub:ai-test-exploration",
  "hub:ai-test-retest-failed"
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

function aiCredentialPath(projectId) {
  const safeId = String(projectId ?? "");
  if (!/^[a-z0-9-]{1,100}$/.test(safeId)) {
    throw new HubError("INVALID_PROJECT", "Game IDが正しくありません。");
  }
  return path.join(appDataRoot(), "ai-testing", "credentials", safeId + ".bin");
}

async function loadUiTarsApiKey(projectId) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    const encrypted = await fs.readFile(aiCredentialPath(projectId));
    return safeStorage.decryptString(encrypted);
  } catch {
    return "";
  }
}

async function saveUiTarsApiKey(projectId, apiKey) {
  const value = String(apiKey ?? "").trim();
  if (!value) return { configured: Boolean(await loadUiTarsApiKey(projectId)) };
  if (!safeStorage.isEncryptionAvailable()) {
    throw new HubError(
      "SECURE_STORAGE_UNAVAILABLE",
      "Windowsの安全な暗号化保存を利用できないためAPIキーを保存できません。ローカルUI-TARSを使うかWindowsの暗号化機能を確認してください。"
    );
  }
  const filePath = aiCredentialPath(projectId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, safeStorage.encryptString(value));
  return { configured: true };
}

async function aiTestProjectDefaults(project) {
  return {
    exePath: "",
    windowTitle: project.name
  };
}

async function aiTestState(projectId) {
  const project = await findProject(projectId);
  const config = await loadAiTestConfig(
    appDataRoot(),
    project.id,
    await aiTestProjectDefaults(project)
  );
  const repository = await inspectRepository(project);
  const history = await listAiTestHistory(appDataRoot(), project.id, 20);
  const latestReport = await latestAiTestReport(appDataRoot(), project.id);
  const apiKeyConfigured = Boolean(await loadUiTarsApiKey(project.id));

  return {
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      commit: repository.commit || "",
      branch: repository.branch || ""
    },
    config,
    apiKeyConfigured,
    emergencyShortcut: AI_TEST_EMERGENCY_SHORTCUT,
    history,
    latestReport
  };
}

async function chooseAiTestExecutable(projectId) {
  const project = await findProject(projectId);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: project.name + " のテスト対象.exeを選択",
    properties: ["openFile"],
    filters: [{ name: "Windows Application", extensions: ["exe"] }]
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, code: "CANCELED", message: "選択をキャンセルしました。" };
  }

  const current = await loadAiTestConfig(
    appDataRoot(),
    project.id,
    await aiTestProjectDefaults(project)
  );
  const config = await saveAiTestConfig(
    appDataRoot(),
    project.id,
    { ...current, exePath: result.filePaths[0] },
    await aiTestProjectDefaults(project)
  );
  return { ok: true, message: "テスト対象.exeを設定しました。", config };
}

async function saveAiTestingConfiguration(payload = {}) {
  const project = await findProject(payload.projectId);
  const config = await saveAiTestConfig(
    appDataRoot(),
    project.id,
    payload.config || {},
    await aiTestProjectDefaults(project)
  );
  if (payload.apiKey) {
    await saveUiTarsApiKey(project.id, payload.apiKey);
  }
  return {
    ok: true,
    message: "自動テスト設定を保存しました。",
    config,
    apiKeyConfigured: Boolean(await loadUiTarsApiKey(project.id))
  };
}

async function captureAiTestEvidence(project, config, runId, testId, phase) {
  const evidenceRoot = path.join(
    appDataRoot(),
    "ai-testing",
    "runs",
    project.id,
    runId,
    "evidence"
  );
  await fs.mkdir(evidenceRoot, { recursive: true });

  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1600, height: 900 },
    fetchWindowIcons: false
  });
  const expected = String(config.windowTitle || "").toLowerCase();
  const source = sources.find((item) =>
    expected && String(item.name || "").toLowerCase().includes(expected)
  );
  if (!source || source.thumbnail.isEmpty()) return "";

  const safeTestId = String(testId || "test").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  const safePhase = String(phase || "capture").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  const fileName = safeTestId + "-" + safePhase + ".png";
  await fs.writeFile(path.join(evidenceRoot, fileName), source.thumbnail.toPNG());
  return path.join("evidence", fileName).replace(/\\/g, "/");
}

function publishAiTestProgress(projectId, patch = {}) {
  const payload = {
    projectId,
    at: new Date().toISOString(),
    ...patch
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:ai-test-progress", payload);
  }
  return payload;
}

async function stopAiTest(reason = "user") {
  if (!activeAiTestRun) {
    return { ok: true, message: "実行中のAIテストはありません。" };
  }

  activeAiTestRun.controller.abort(reason);
  try {
    if (activeAiTestRun.child && !activeAiTestRun.child.killed) {
      activeAiTestRun.child.kill();
    }
  } catch {}
  publishAiTestProgress(activeAiTestRun.projectId, {
    phase: "stopped",
    message: "AI操作を緊急停止しました。"
  });
  return { ok: true, message: "AI操作を緊急停止しました。" };
}

function aiFailureResult(test, error, evidence = {}) {
  const code = String(error?.message || error || "UNKNOWN");
  let status = "UNKNOWN";
  let reason = "AIテストを完了できませんでした。";

  if (code.includes("AI_TEST_BLOCKED_ACTION")) {
    status = "WARNING";
    reason = "安全機能が危険または未許可の操作を停止しました。";
  } else if (code.includes("AI_TEST_WINDOW_SCOPE_VIOLATION")) {
    status = "WARNING";
    reason = "AIが許可範囲外のウィンドウを操作しようとしたため停止しました。";
  } else if (code.includes("AI_TEST_STUCK_REPEAT")) {
    status = "WARNING";
    reason = "同じ操作の繰り返しを検知したため停止しました。";
  } else if (code.includes("AI_TEST_TIMEOUT")) {
    reason = "テストの制限時間を超えました。";
  } else if (code.includes("AI_TEST_ABORTED")) {
    reason = "緊急停止されました。";
  }

  return {
    id: test.id,
    name: test.name,
    description: test.description,
    expected: test.expected,
    actual: "",
    status,
    confidence: "low",
    reason,
    startedAt: evidence.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    evidence: {
      beforeScreenshot: evidence.beforeScreenshot || "",
      afterScreenshot: evidence.afterScreenshot || "",
      failScreenshot: evidence.afterScreenshot || ""
    },
    actions: [],
    reproductionSteps: []
  };
}

async function runAiTestSuite(payload = {}) {
  const project = await findProject(payload.projectId);
  if (activeAiTestRun) {
    throw new HubError("AI_TEST_ALREADY_RUNNING", "別のAIテストが実行中です。先に停止してください。");
  }

  const config = await loadAiTestConfig(
    appDataRoot(),
    project.id,
    await aiTestProjectDefaults(project)
  );

  if (config.engine === "disabled") {
    throw new HubError("AI_TEST_DISABLED", "AI操作エンジンが無効です。");
  }
  if (config.engine === "agent-s") {
    throw new HubError(
      "AGENT_S_NOT_CONNECTED",
      "Agent-Sは予備エンジンとして設定できますが、第1段階ではまだ接続していません。UI-TARSを選択してください。"
    );
  }

  const executable = await inspectExecutable(config.exePath);
  if (!executable.ok) throw new HubError(executable.code, executable.message);

  const deps = await inspectUiTarsDependencies();
  if (!deps.sdk || !deps.operator || !deps.nutJs) {
    throw new HubError(
      "UI_TARS_DEPENDENCY_MISSING",
      deps.error || "UI-TARSの必要コンポーネントを読み込めません。"
    );
  }

  if (!config.windowTitle) {
    throw new HubError("WINDOW_TITLE_REQUIRED", "テスト対象のウィンドウ名を設定してください。");
  }
  if (!config.uiTars.baseUrl || !config.uiTars.model) {
    throw new HubError("UI_TARS_CONFIG_REQUIRED", "UI-TARSの接続先とモデル名を設定してください。");
  }

  const externalConsent = await confirmExternalAiEndpoint(config);
  if (!externalConsent) {
    return {
      ok: false,
      code: "CANCELED",
      message: "外部AIへの画面送信をキャンセルしました。"
    };
  }

  const repository = await inspectRepository(project);
  const runId = makeTestRunId();
  const controller = new AbortController();
  const launched = await launchTestExecutable(config);
  activeAiTestRun = {
    projectId: project.id,
    runId,
    controller,
    child: launched.child
  };

  const startedAt = new Date().toISOString();
  const tests = [];
  let windowInfo = null;

  try {
    publishAiTestProgress(project.id, {
      phase: "launching",
      testRunId: runId,
      current: 0,
      total: 0,
      message: "ゲームを起動し、ウィンドウを探しています。"
    });

    windowInfo = await findAndFocusTargetWindow(config.windowTitle, 20000, controller.signal);
    if (!windowInfo.ok) {
      throw new HubError(windowInfo.code, windowInfo.message);
    }

    let selectedTests = config.tests.filter((item) => item.enabled !== false);
    if (payload.failedOnly) {
      const previous = await latestAiTestReport(appDataRoot(), project.id);
      const failedIds = new Set(
        (previous?.tests || []).filter((item) => item.status === "FAIL").map((item) => item.id)
      );
      selectedTests = selectedTests.filter((item) => failedIds.has(item.id));
      if (!selectedTests.length) {
        throw new HubError("NO_FAILED_TESTS", "前回FAILしたテストはありません。");
      }
    }

    if (payload.mode === "exploration") {
      selectedTests = [{
        id: "ai_exploration",
        name: "AI探索テスト",
        description: "ゲームを安全な範囲で自由に操作し、操作不能、UI崩れ、進行不能、おかしな挙動を探す",
        expected: "確認できた問題があれば具体的な事実と再現操作を報告し、問題を確認できなければその旨を示す",
        timeout: Math.min(300, Math.max(60, config.timeout * 2)),
        enabled: true
      }];
    }

    publishAiTestProgress(project.id, {
      phase: "running",
      testRunId: runId,
      current: 0,
      total: selectedTests.length,
      message: "AIテストを開始します。"
    });

    const apiKey = await loadUiTarsApiKey(project.id);

    for (let index = 0; index < selectedTests.length; index += 1) {
      if (controller.signal.aborted) break;
      const test = selectedTests[index];
      const testStartedAt = new Date().toISOString();

      publishAiTestProgress(project.id, {
        phase: "test",
        testRunId: runId,
        current: index + 1,
        total: selectedTests.length,
        testId: test.id,
        testName: test.name,
        message: test.description
      });

      const beforeScreenshot = await captureAiTestEvidence(
        project, config, runId, test.id, "before"
      );

      if (test.id === "game_launch") {
        const afterScreenshot = await captureAiTestEvidence(
          project, config, runId, test.id, "after"
        );
        tests.push({
          id: test.id,
          name: test.name,
          description: test.description,
          expected: test.expected,
          actual: "対象ウィンドウ「" + windowInfo.title + "」を検出しました。",
          status: "PASS",
          confidence: "high",
          reason: "Hubが起動したプロセスの対象ウィンドウを検出し、フォーカスできました。",
          startedAt: testStartedAt,
          completedAt: new Date().toISOString(),
          evidence: { beforeScreenshot, afterScreenshot, failScreenshot: "" },
          actions: [],
          reproductionSteps: []
        });
        continue;
      }

      try {
        const result = await runUiTarsTest({
          config,
          test,
          apiKey,
          allowedWindowTitles: [config.windowTitle],
          signal: controller.signal,
          onProgress: (progress) => publishAiTestProgress(project.id, {
            ...progress,
            testRunId: runId,
            current: index + 1,
            total: selectedTests.length,
            testId: test.id,
            testName: test.name
          })
        });
        const afterScreenshot = await captureAiTestEvidence(
          project, config, runId, test.id, "after"
        );
        tests.push({
          id: test.id,
          name: test.name,
          description: test.description,
          expected: test.expected,
          actual: result.actual || "",
          status: result.status || "UNKNOWN",
          confidence: result.confidence || "low",
          reason: result.reason || "",
          startedAt: testStartedAt,
          completedAt: new Date().toISOString(),
          evidence: {
            beforeScreenshot,
            afterScreenshot,
            failScreenshot: result.status === "FAIL" ? afterScreenshot : ""
          },
          actions: result.actions || [],
          reproductionSteps: result.status === "FAIL"
            ? buildReproductionSteps(result.actions || [])
            : []
        });
      } catch (error) {
        const afterScreenshot = await captureAiTestEvidence(
          project, config, runId, test.id, "after"
        ).catch(() => "");
        tests.push(aiFailureResult(test, error, {
          startedAt: testStartedAt,
          beforeScreenshot,
          afterScreenshot
        }));
      }
    }

    const completedAt = new Date().toISOString();
    const homePath = app.getPath("home");
    const runtimeLogTail = (launched.logs || []).slice(-30).map((line) =>
      redactHomePath(String(line), homePath).slice(0, 1200)
    );
    const report = {
      project: project.name,
      projectId: project.id,
      testRunId: runId,
      mode: payload.mode === "exploration" ? "exploration" : (payload.failedOnly ? "failed-retest" : "fixed"),
      engine: "UI-TARS",
      targetVersion: config.targetVersion || app.getVersion(),
      gitCommit: repository.commit || "",
      startedAt,
      completedAt,
      stopped: controller.signal.aborted,
      summary: summarizeAiTestResults(tests),
      tests,
      runtimeLogTail,
      safety: {
        windowScope: [config.windowTitle],
        emergencyShortcut: AI_TEST_EMERGENCY_SHORTCUT,
        arbitraryShellAllowed: false,
        externalSendAllowed: false
      }
    };

    const saved = await saveAiTestReport(appDataRoot(), project.id, report);
    publishAiTestProgress(project.id, {
      phase: "completed",
      testRunId: runId,
      current: tests.length,
      total: tests.length,
      message: controller.signal.aborted ? "AIテストを停止しました。" : "AIテストが完了しました。",
      summary: saved.report.summary
    });
    return {
      ok: true,
      message: controller.signal.aborted ? "AIテストを停止し、途中結果を保存しました。" : "AIテスト結果を保存しました。",
      report: saved.report,
      history: await listAiTestHistory(appDataRoot(), project.id, 20)
    };
  } finally {
    activeAiTestRun = null;
  }
}

function isLoopbackAiEndpoint(baseUrl) {
  try {
    const url = new URL(String(baseUrl || ""));
    const host = url.hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

async function confirmExternalAiEndpoint(config) {
  if (isLoopbackAiEndpoint(config?.uiTars?.baseUrl)) return true;

  let endpointLabel = String(config?.uiTars?.baseUrl || "");
  try {
    endpointLabel = new URL(endpointLabel).origin;
  } catch {}

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["キャンセル", "外部AIへ送信してテスト開始"],
    defaultId: 0,
    cancelId: 0,
    title: "外部AIへの画面送信を確認",
    message: "このAIテストはローカル接続ではありません。",
    detail:
      "接続先: " + endpointLabel + "\n\n" +
      "ゲーム画面のScreenshotとテスト指示が、この接続先のAIサービスへ送信される可能性があります。" +
      " 外部Providerを利用する場合はProvider側の料金が発生する可能性もあります。\n\n" +
      "Game Dev HubはGitHub push、購入、Password入力、管理者操作などをAIへ許可しませんが、" +
      "外部AIへの画面送信自体はこの確認後にだけ開始します。"
  });
  return result.response === 1;
}

async function probeAiEndpoint(baseUrl) {
  let target;
  try {
    target = new URL(String(baseUrl || ""));
    if (!["http:", "https:"].includes(target.protocol)) {
      return { ok: false, detail: "HTTP/HTTPSのBase URLではありません。" };
    }
  } catch {
    return { ok: false, detail: "Base URLが正しくありません。" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("diagnostic-timeout"), 4000);
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });
    return {
      ok: true,
      detail: "Endpointへ到達しました（HTTP " + response.status + "）。Model推論は実行していません。"
    };
  } catch (error) {
    return {
      ok: false,
      detail: "Endpointへ接続できません: " + String(error?.message || error).slice(0, 220)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function aiTestDiagnostics(projectId) {
  const project = await findProject(projectId);
  const config = await loadAiTestConfig(
    appDataRoot(),
    project.id,
    await aiTestProjectDefaults(project)
  );
  const deps = await inspectUiTarsDependencies();
  const endpoint = await probeAiEndpoint(config.uiTars.baseUrl);
  const executable = await inspectExecutable(config.exePath);
  const secureStorage = safeStorage.isEncryptionAvailable();

  return {
    ok: true,
    diagnostics: {
      platform: process.platform === "win32"
        ? { ok: true, label: "Windows OK" }
        : { ok: false, label: "Windows以外では自動操作を実行しません。" },
      uiTars: {
        ok: deps.sdk && deps.operator && endpoint.ok,
        label: deps.sdk && deps.operator && endpoint.ok
          ? "SDK / Operator / Endpoint OK"
          : (deps.error || endpoint.detail || "NG"),
        cause: !deps.sdk || !deps.operator
          ? "UI-TARS SDKまたはNutJS Operatorを読み込めません。"
          : (!endpoint.ok ? endpoint.detail : ""),
        action: !deps.sdk || !deps.operator
          ? "Game Dev Hubを最新版へ更新・再インストールして依存関係を復旧してください。"
          : (!endpoint.ok ? "UI-TARS Model Serverを起動し、Base URLを確認してください。" : "")
      },
      python: {
        ok: true,
        label: "第1段階のUI-TARS SDK構成では不要"
      },
      gpu: {
        ok: true,
        label: "Hubからは必須判定しません。ローカルModel利用時のみModel要件を確認してください。"
      },
      executable: {
        ok: executable.ok,
        label: executable.ok ? "OK" : executable.message,
        cause: executable.ok ? "" : executable.message,
        action: executable.ok ? "" : "「テスト対象.exe」の選択から実際のWindowsゲーム.exeを設定してください。"
      },
      screenshot: {
        ok: true,
        label: "Electron window captureを実行時に確認"
      },
      keyboard: {
        ok: deps.nutJs,
        label: deps.nutJs ? "利用可能" : "Computer Use入力基盤 NG"
      },
      mouse: {
        ok: deps.nutJs,
        label: deps.nutJs ? "利用可能" : "Computer Use入力基盤 NG"
      },
      secureStorage: {
        ok: secureStorage,
        label: secureStorage ? "APIキー暗号化保存 OK" : "APIキー保存不可",
        cause: secureStorage ? "" : "Electron safeStorageの暗号化機能を利用できません。",
        action: secureStorage ? "" : "外部APIキーを保存せずLocal UI-TARSを使うか、Windows暗号化機能を確認してください。"
      },
      engine: config.engine,
      service: {
        name: "UI-TARS / configured OpenAI-compatible endpoint",
        endpoint: config.uiTars.baseUrl,
        local: isLoopbackAiEndpoint(config.uiTars.baseUrl),
        billing: isLoopbackAiEndpoint(config.uiTars.baseUrl)
          ? "ローカル接続。Game Dev Hubからの外部API課金はありません。"
          : "外部接続。Providerの料金体系はHubから判定できません。開始前に毎回確認を表示します。",
        localAlternative: "localhost / 127.0.0.1 のOpenAI互換UI-TARS Model Server"
      }
    }
  };
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

async function copyLatestAiTestEvidence(projectId, report, destinationRoot) {
  if (!report?.testRunId || !Array.isArray(report.tests)) return [];

  const candidates = new Set();
  for (const test of report.tests) {
    for (const value of [
      test?.evidence?.beforeScreenshot,
      test?.evidence?.afterScreenshot,
      test?.evidence?.failScreenshot
    ]) {
      const relative = String(value || "").replace(/\\/g, "/");
      if (/^evidence\/[A-Za-z0-9_-]+\.png$/.test(relative)) {
        candidates.add(relative);
      }
    }
  }

  if (!candidates.size) return [];
  const targetDir = path.join(destinationRoot, "ai-test-evidence");
  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  for (const relative of candidates) {
    const source = path.join(
      appDataRoot(),
      "ai-testing",
      "runs",
      projectId,
      report.testRunId,
      ...relative.split("/")
    );
    const name = path.basename(relative);
    try {
      await fs.copyFile(source, path.join(targetDir, name));
      copied.push(path.join("ai-test-evidence", name).replace(/\\/g, "/"));
    } catch {
      // Evidence may have been manually removed; keep pack generation resilient.
    }
  }
  return copied;
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
  const diagnostics = await diagnosticsSnapshot();
  const latestAiTest = await latestAiTestReport(appDataRoot(), project.id);
  const aiTestEvidence = await copyLatestAiTestEvidence(project.id, latestAiTest, packRoot);
  const homePath = app.getPath("home");

  const pack = {
    schemaVersion: 4,
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
      note: "Gameの実プレイ結果はUserがHubで選択した確認結果、AI自動テスト結果、画像、User messageをEvidenceとして判断する。",
      summary: verificationSummary,
      allUserTaskResults,
      activeTaskResult: activeVerification
    },
    aiTesting: latestAiTest ? {
      testRunId: latestAiTest.testRunId,
      mode: latestAiTest.mode,
      engine: latestAiTest.engine,
      targetVersion: latestAiTest.targetVersion,
      gitCommit: latestAiTest.gitCommit,
      startedAt: latestAiTest.startedAt,
      completedAt: latestAiTest.completedAt,
      stopped: latestAiTest.stopped === true,
      summary: latestAiTest.summary,
      tests: latestAiTest.tests
    } : null,
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
      aiTestEvidence
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
    latestAiTest
      ? "- " + latestAiTest.testRunId + " / PASS " + (latestAiTest.summary?.passed || 0) +
        " / FAIL " + (latestAiTest.summary?.failed || 0) +
        " / WARNING " + (latestAiTest.summary?.warning || 0) +
        " / UNKNOWN " + (latestAiTest.summary?.unknown || 0)
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
    "- AI自動テストEvidenceがある場合は、AI判定だけでなくScreenshot・操作記録も根拠として扱う",
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
    fileCount: 2 + referenceImages.length + aiTestEvidence.length + (mainWindow && !mainWindow.isDestroyed() ? 1 : 0)
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
    registerIpc("hub:ai-test-state", aiTestState);
    registerIpc("hub:ai-test-choose-executable", chooseAiTestExecutable);
    registerIpc("hub:ai-test-config-save", saveAiTestingConfiguration);
    registerIpc("hub:ai-test-run", (payload) => runAiTestSuite({ ...payload, mode: "fixed", failedOnly: false }));
    registerIpc("hub:ai-test-retest-failed", (payload) => runAiTestSuite({ ...payload, mode: "fixed", failedOnly: true }));
    registerIpc("hub:ai-test-exploration", (payload) => runAiTestSuite({ ...payload, mode: "exploration", failedOnly: false }));
    registerIpc("hub:ai-test-stop", () => stopAiTest("ipc"));
    registerIpc("hub:ai-test-diagnostics", aiTestDiagnostics);
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

    const emergencyRegistered = globalShortcut.register(AI_TEST_EMERGENCY_SHORTCUT, () => {
      void stopAiTest("shortcut");
    });
    if (!emergencyRegistered) {
      void writeFoundationLog("ai-test.emergency-shortcut-unavailable", {
        level: "warning",
        code: "AI_TEST_SHORTCUT_UNAVAILABLE"
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
  globalShortcut.unregisterAll();
  if (activeAiTestRun) {
    activeAiTestRun.controller.abort("app-quit");
    try {
      activeAiTestRun.child?.kill();
    } catch {}
  }
  void persistWindowState();
  void writeFoundationLog("app.quit");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
