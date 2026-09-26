import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

export const AUTO_TEST_SCHEMA_VERSION = 1;
export const AUTO_TEST_ENGINES = new Set(["ui-tars", "agent-s", "disabled"]);
export const AUTO_TEST_STATUSES = new Set(["PASS", "FAIL", "WARNING", "UNKNOWN"]);

const DEFAULT_TESTS = [
  {
    id: "wasd_movement",
    name: "WASDで操作できる",
    description: "ゲーム画面でW/A/S/Dを短く入力し、操作に反応するか確認する",
    expected: "入力に応じてキャラクターまたはゲーム画面が変化し、操作不能にならない",
    timeout: 45,
    enabled: true
  },
  {
    id: "mouse_click",
    name: "マウス操作ができる",
    description: "ゲーム画面内の安全な操作対象を探して左クリックする",
    expected: "クリックに対してゲーム内UIまたはゲーム状態が反応する",
    timeout: 45,
    enabled: true
  }
];

export function defaultAutoTestConfig() {
  return {
    schemaVersion: AUTO_TEST_SCHEMA_VERSION,
    engine: "ui-tars",
    exePath: "",
    launchArgs: [],
    windowTitle: "",
    targetVersion: "",
    timeout: 60,
    maxAgentSteps: 25,
    model: {
      baseURL: "http://127.0.0.1:8000/v1",
      name: "ui-tars",
      serviceLabel: "OpenAI互換エンドポイント",
      localPreferred: true
    },
    evidence: {
      location: "app-data",
      recordingReady: true
    },
    safety: {
      allowedApps: ["target-game"],
      emergencyShortcut: "CommandOrControl+Shift+F12",
      sameActionLimit: 5,
      unchangedScreenLimit: 5
    },
    tests: DEFAULT_TESTS.map((test) => ({ ...test }))
  };
}

function cleanText(value, max = 500) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max)
    : "";
}

function cleanProjectId(value) {
  const id = cleanText(value, 100).toLowerCase();
  if (!/^[a-z0-9._-]{1,100}$/.test(id)) {
    throw new Error("Project IDが正しくありません。");
  }
  return id;
}

function cleanAbsoluteExe(value) {
  const candidate = cleanText(value, 1000);
  if (!candidate || !path.isAbsolute(candidate) || path.extname(candidate).toLowerCase() !== ".exe") {
    return "";
  }
  return path.normalize(candidate);
}

function cleanBaseUrl(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function cleanLaunchArgs(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 32)
    .map((item) => cleanText(item, 300))
    .filter(Boolean);
}

export function sanitizeAutoTestDefinition(raw = {}, index = 0) {
  const rawId = cleanText(raw.id, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const id = rawId.replace(/^_+|_+$/g, "") || `test_${index + 1}`;
  return {
    id,
    name: cleanText(raw.name, 140) || `テスト ${index + 1}`,
    description: cleanText(raw.description, 1200),
    expected: cleanText(raw.expected, 1200),
    timeout: Math.min(600, Math.max(10, Number(raw.timeout) || 60)),
    enabled: raw.enabled !== false
  };
}

export function sanitizeAutoTestConfig(raw = {}) {
  const defaults = defaultAutoTestConfig();
  const engine = AUTO_TEST_ENGINES.has(raw.engine) ? raw.engine : defaults.engine;
  const rawTests = Array.isArray(raw.tests) ? raw.tests.slice(0, 50) : defaults.tests;
  const seen = new Set();
  const tests = rawTests.map((test, index) => {
    const normalized = sanitizeAutoTestDefinition(test, index);
    let id = normalized.id;
    let suffix = 2;
    while (seen.has(id)) id = normalized.id + "_" + suffix++;
    seen.add(id);
    return { ...normalized, id };
  });

  return {
    schemaVersion: AUTO_TEST_SCHEMA_VERSION,
    engine,
    exePath: cleanAbsoluteExe(raw.exePath),
    launchArgs: cleanLaunchArgs(raw.launchArgs),
    windowTitle: cleanText(raw.windowTitle, 200),
    targetVersion: cleanText(raw.targetVersion, 120),
    timeout: Math.min(900, Math.max(15, Number(raw.timeout) || defaults.timeout)),
    maxAgentSteps: Math.min(80, Math.max(5, Number(raw.maxAgentSteps) || defaults.maxAgentSteps)),
    model: {
      baseURL: cleanBaseUrl(raw.model?.baseURL) || defaults.model.baseURL,
      name: cleanText(raw.model?.name, 160) || defaults.model.name,
      serviceLabel: cleanText(raw.model?.serviceLabel, 160) || defaults.model.serviceLabel,
      localPreferred: raw.model?.localPreferred !== false
    },
    evidence: {
      location: "app-data",
      recordingReady: true
    },
    safety: {
      allowedApps: ["target-game"],
      emergencyShortcut: "CommandOrControl+Shift+F12",
      sameActionLimit: Math.min(10, Math.max(3, Number(raw.safety?.sameActionLimit) || defaults.safety.sameActionLimit)),
      unchangedScreenLimit: Math.min(10, Math.max(3, Number(raw.safety?.unchangedScreenLimit) || defaults.safety.unchangedScreenLimit))
    },
    tests
  };
}

function projectRoot(userDataPath, projectId) {
  return path.join(userDataPath, "auto-tests", cleanProjectId(projectId));
}

export async function loadAutoTestConfig(userDataPath, projectId) {
  const filePath = path.join(projectRoot(userDataPath, projectId), "config.json");
  const loaded = await readJsonRecovering(filePath, defaultAutoTestConfig());
  const safe = sanitizeAutoTestConfig(loaded.value);
  if (JSON.stringify(loaded.value) !== JSON.stringify(safe)) {
    await writeJsonAtomic(filePath, safe);
  }
  return safe;
}

export async function saveAutoTestConfig(userDataPath, projectId, input) {
  const filePath = path.join(projectRoot(userDataPath, projectId), "config.json");
  const safe = sanitizeAutoTestConfig(input);
  await writeJsonAtomic(filePath, safe);
  return safe;
}

async function loadHistoryFile(userDataPath, projectId) {
  const filePath = path.join(projectRoot(userDataPath, projectId), "history.json");
  const loaded = await readJsonRecovering(filePath, { schemaVersion: 1, runs: [] });
  const runs = Array.isArray(loaded.value?.runs) ? loaded.value.runs.slice(0, 50) : [];
  return { schemaVersion: 1, runs };
}

export async function listAutoTestRuns(userDataPath, projectId) {
  return (await loadHistoryFile(userDataPath, projectId)).runs;
}

export async function loadLatestAutoTestReport(userDataPath, projectId) {
  const history = await loadHistoryFile(userDataPath, projectId);
  const latest = history.runs[0];
  if (!latest?.runId) return null;
  try {
    const raw = await fs.readFile(
      path.join(projectRoot(userDataPath, projectId), "runs", latest.runId, "report.json"),
      "utf8"
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function summarizeReport(report) {
  const tests = Array.isArray(report.tests) ? report.tests : [];
  const count = (status) => tests.filter((test) => test.status === status).length;
  return {
    runId: report.testRunId,
    testedAt: report.testedAt,
    engine: report.engine,
    commit: report.gitCommit || "",
    targetVersion: report.targetVersion || "",
    total: tests.length,
    passed: count("PASS"),
    failed: count("FAIL"),
    warning: count("WARNING"),
    unknown: count("UNKNOWN")
  };
}

export async function saveAutoTestReport(userDataPath, projectId, report) {
  const root = projectRoot(userDataPath, projectId);
  const runDir = path.join(root, "runs", report.testRunId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  const history = await loadHistoryFile(userDataPath, projectId);
  const summary = summarizeReport(report);
  const next = [summary, ...history.runs.filter((item) => item.runId !== summary.runId)].slice(0, 50);
  await writeJsonAtomic(path.join(root, "history.json"), { schemaVersion: 1, runs: next });
  return { runDir, summary };
}

export async function copyLatestAutoTestForPack(userDataPath, projectId, packRoot) {
  const report = await loadLatestAutoTestReport(userDataPath, projectId);
  if (!report) return null;
  const source = path.join(projectRoot(userDataPath, projectId), "runs", report.testRunId);
  const destination = path.join(packRoot, "auto-test");
  await fs.mkdir(destination, { recursive: true });
  await fs.copyFile(path.join(source, "report.json"), path.join(destination, "report.json"));

  const evidenceSource = path.join(source, "evidence");
  const evidenceDestination = path.join(destination, "evidence");
  const copied = [];
  try {
    const files = await fs.readdir(evidenceSource);
    await fs.mkdir(evidenceDestination, { recursive: true });
    for (const file of files.slice(0, 80)) {
      if (!/\.(png|jpg|jpeg)$/i.test(file)) continue;
      await fs.copyFile(path.join(evidenceSource, file), path.join(evidenceDestination, file));
      copied.push("auto-test/evidence/" + file);
    }
  } catch {
    // Evidence can be absent for interrupted/diagnostic-only runs.
  }

  return {
    report: "auto-test/report.json",
    evidence: copied,
    summary: summarizeReport(report)
  };
}

function normalizePath(value) {
  return String(value || "").replace(/\//g, "\\").toLowerCase();
}

function targetMatches(windowInfo, exePath, windowTitle, processId = null) {
  if (!windowInfo) return false;
  const ownerPath = normalizePath(windowInfo.owner?.path);
  const wantedPath = normalizePath(exePath);
  if (ownerPath && wantedPath && ownerPath === wantedPath) return true;
  if (processId && Number(windowInfo.owner?.processId) === Number(processId)) return true;
  const title = String(windowInfo.title || "");
  if (windowTitle && title.toLowerCase().includes(windowTitle.toLowerCase())) return true;
  return false;
}

function sanitizeActionLog(params) {
  const parsed = params?.parsedPrediction || {};
  const type = cleanText(parsed.action_type, 80);
  const inputs = parsed.action_inputs && typeof parsed.action_inputs === "object"
    ? { ...parsed.action_inputs }
    : {};
  if (typeof inputs.content === "string") {
    inputs.content = `[入力 ${inputs.content.length}文字]`;
  }
  return {
    at: new Date().toISOString(),
    type,
    inputs: Object.fromEntries(
      Object.entries(inputs).slice(0, 12).map(([key, value]) => [
        cleanText(key, 80),
        typeof value === "string" ? cleanText(value, 220) : value
      ])
    )
  };
}

function confidenceValue(value) {
  const normalized = cleanText(value, 20).toLowerCase();
  return ["high", "medium", "low"].includes(normalized) ? normalized : "unknown";
}

function reportActionToStatus(actionType) {
  if (actionType === "report_pass") return "PASS";
  if (actionType === "report_fail") return "FAIL";
  if (actionType === "report_warning") return "WARNING";
  return "UNKNOWN";
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function diagnoseAutoTest({ config: rawConfig, apiKey = "" } = {}) {
  const config = sanitizeAutoTestConfig(rawConfig);
  const result = {
    checkedAt: new Date().toISOString(),
    platform: {
      status: process.platform === "win32" ? "OK" : "NG",
      message: process.platform === "win32" ? "Windowsを検出しました。" : "Windows専用機能です。"
    },
    uiTars: { status: "NG", message: "未確認" },
    python: {
      status: "OK",
      message: "現在の実装はNode/Electron版UI-TARS SDKを使うためPythonサービスは不要です。"
    },
    gpu: {
      status: "WARNING",
      message: "GPU要件はUI-TARS Model endpointの実行先に依存します。Hubだけでは正常性を断定しません。"
    },
    computerOperator: { status: "NG", message: "未確認" },
    screenshot: { status: "NG", message: "未確認" },
    keyboard: { status: "NG", message: "未確認" },
    mouse: { status: "NG", message: "未確認" },
    windowDetection: { status: "NG", message: "未確認" },
    exe: { status: "NG", message: "実行ファイルを設定してください。" },
    modelEndpoint: { status: "NG", message: "未確認" }
  };

  if (config.exePath && await fileExists(config.exePath)) {
    result.exe = { status: "OK", message: "テスト対象exeを確認できました。" };
  } else if (config.exePath) {
    result.exe = { status: "NG", message: "設定されたexeが見つかりません。" };
  }

  if (config.engine !== "ui-tars") {
    result.uiTars = {
      status: config.engine === "disabled" ? "NG" : "WARNING",
      message: config.engine === "agent-s"
        ? "Agent-Sはフォールバック候補ですが、現在の初期実装では未接続です。"
        : "AI操作エンジンが無効です。"
    };
    return result;
  }

  try {
    await import("@ui-tars/sdk");
    result.uiTars = { status: "OK", message: "UI-TARS SDKを読み込めます。" };
  } catch (error) {
    result.uiTars = { status: "NG", message: "UI-TARS SDKを読み込めません: " + cleanText(error?.message, 200) };
  }

  try {
    await import("@ui-tars/operator-nut-js");
    await import("@computer-use/nut-js");
    result.computerOperator = { status: "OK", message: "スクリーンショット・マウス・キーボード操作を利用できます。" };
    result.screenshot = { status: "OK", message: "UI-TARS Computer Operatorの画面取得機能を読み込めます。" };
    result.keyboard = { status: "OK", message: "UI-TARS Computer Operatorのキーボード操作機能を読み込めます。" };
    result.mouse = { status: "OK", message: "UI-TARS Computer Operatorのマウス操作機能を読み込めます。" };
  } catch (error) {
    result.computerOperator = { status: "NG", message: "Computer Operatorを読み込めません: " + cleanText(error?.message, 200) };
    result.screenshot = { status: "NG", message: "画面取得機能を利用できません。" };
    result.keyboard = { status: "NG", message: "キーボード操作機能を利用できません。" };
    result.mouse = { status: "NG", message: "マウス操作機能を利用できません。" };
  }

  try {
    await import("get-windows");
    result.windowDetection = { status: "OK", message: "前面ウィンドウを検査できます。" };
  } catch (error) {
    result.windowDetection = { status: "NG", message: "ウィンドウ検出機能を読み込めません: " + cleanText(error?.message, 200) };
  }

  if (!config.model.baseURL) {
    result.modelEndpoint = { status: "NG", message: "UI-TARS Modelの接続先が未設定です。" };
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(config.model.baseURL.replace(/\/$/, "") + "/models", {
        method: "GET",
        headers: apiKey ? { Authorization: "Bearer " + apiKey } : {},
        signal: controller.signal
      });
      result.modelEndpoint = response.ok
        ? { status: "OK", message: "UI-TARS Model endpointへ接続できました。" }
        : { status: "WARNING", message: "接続先は応答しましたが /models は HTTP " + response.status + " でした。" };
    } catch (error) {
      result.modelEndpoint = {
        status: "NG",
        message: "UI-TARS Model endpointへ接続できません: " + cleanText(error?.message, 180)
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return result;
}

let activeRun = null;

async function releaseCommonKeys() {
  try {
    const { Key, keyboard } = await import("@computer-use/nut-js");
    for (const key of [Key.W, Key.A, Key.S, Key.D, Key.Space, Key.LeftShift, Key.LeftControl, Key.LeftAlt]) {
      try {
        await keyboard.releaseKey(key);
      } catch {
        // Best effort emergency release.
      }
    }
  } catch {
    // Operator dependency may be unavailable; AbortSignal still stops the agent loop.
  }
}

export async function stopActiveAutoTest(reason = "user") {
  if (!activeRun) return false;
  activeRun.stopReason = cleanText(reason, 80) || "user";
  activeRun.abortController.abort();
  await releaseCommonKeys();
  return true;
}

export function getActiveAutoTestState() {
  if (!activeRun) return { running: false };
  return {
    running: true,
    runId: activeRun.runId,
    projectId: activeRun.projectId,
    startedAt: activeRun.startedAt,
    stopReason: activeRun.stopReason || ""
  };
}

async function wait(ms, signal) {
  await new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("AIテストを停止しました。"));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForTargetWindow(openWindows, config, processId, signal, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (signal.aborted) throw new Error("AIテストを停止しました。");
    const windows = await openWindows();
    const found = windows.find((item) => targetMatches(item, config.exePath, config.windowTitle, processId));
    if (found) return found;
    await wait(500, signal);
  }
  throw new Error("ゲームウィンドウを検出できませんでした。window名またはexeを確認してください。");
}

async function ensureTargetForeground({ activeWindow, target, config, processId }) {
  let current = await activeWindow();
  if (targetMatches(current, config.exePath, config.windowTitle, processId)) return current;

  try {
    const { Key, keyboard } = await import("@computer-use/nut-js");
    await keyboard.pressKey(Key.LeftAlt, Key.Tab);
    await keyboard.releaseKey(Key.LeftAlt, Key.Tab);
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {
    // The follow-up foreground check provides the actual result.
  }

  current = await activeWindow();
  if (!targetMatches(current, config.exePath, config.windowTitle, processId)) {
    throw new Error(
      "テスト対象ゲームを前面にできませんでした。ゲームを前面にしてから再テストしてください。"
    );
  }
  return current;
}

function actionFingerprint(params) {
  const parsed = params?.parsedPrediction || {};
  return JSON.stringify({
    type: parsed.action_type || "",
    inputs: parsed.action_inputs || {}
  });
}

function isPointerAction(type) {
  return new Set([
    "click", "left_click", "left_single", "left_double", "double_click",
    "right_click", "right_single", "middle_click", "mouse_move", "hover",
    "left_click_drag", "drag", "select", "scroll"
  ]).has(type);
}

function blockedHotkey(params) {
  const parsed = params?.parsedPrediction || {};
  const type = parsed.action_type || "";
  if (!["hotkey", "press", "release"].includes(type)) return false;
  const key = String(parsed.action_inputs?.key || parsed.action_inputs?.hotkey || "").toLowerCase();
  if (/\b(win|meta|command|cmd|super)\b/.test(key)) return true;
  const compact = key.replace(/\s+/g, "");
  return compact.includes("ctrl+shift+esc") || compact.includes("control+shift+escape") ||
    compact.includes("ctrl+alt+delete") || compact.includes("alt+tab");
}

function pointInsideBounds(point, bounds) {
  if (!point || !bounds || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export async function runAutoTests({
  userDataPath,
  project,
  config: rawConfig,
  apiKey = "",
  gitCommit = "",
  appVersion = "",
  onlyTestIds = null,
  onProgress = () => {}
}) {
  if (activeRun) throw new Error("別のAIテストが実行中です。先に停止してください。");
  const config = sanitizeAutoTestConfig(rawConfig);
  if (config.engine !== "ui-tars") {
    throw new Error(config.engine === "agent-s"
      ? "Agent-Sは現在の初期実装では未接続です。UI-TARSを選択してください。"
      : "AI操作エンジンが無効です。");
  }
  if (!config.exePath || !(await fileExists(config.exePath))) {
    throw new Error("テスト対象exeが見つかりません。自動テスト設定でexeを選択してください。");
  }

  const [{ GUIAgent, StatusEnum }, core, operatorModule, windowModule] = await Promise.all([
    import("@ui-tars/sdk"),
    import("@ui-tars/sdk/core"),
    import("@ui-tars/operator-nut-js"),
    import("get-windows")
  ]);
  const { parseBoxToScreenCoords } = core;
  const { NutJSOperator } = operatorModule;
  const { activeWindow, openWindows } = windowModule;

  const startedAt = new Date();
  const runId = startedAt.toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomBytes(3).toString("hex");
  const abortController = new AbortController();
  activeRun = {
    runId,
    projectId: project.id,
    startedAt: startedAt.toISOString(),
    abortController,
    stopReason: ""
  };

  const runDir = path.join(projectRoot(userDataPath, project.id), "runs", runId);
  const evidenceDir = path.join(runDir, "evidence");
  await fs.mkdir(evidenceDir, { recursive: true });

  const enabledTests = config.tests.filter((test) => test.enabled);
  const selectedTests = Array.isArray(onlyTestIds)
    ? enabledTests.filter((test) => onlyTestIds.includes(test.id))
    : enabledTests;
  if (!selectedTests.length) {
    activeRun = null;
    throw new Error("実行するテスト項目がありません。");
  }

  const progressBase = {
    runId,
    total: selectedTests.length,
    startedAt: startedAt.toISOString()
  };
  const emit = (patch) => {
    try {
      onProgress({ ...progressBase, ...patch, elapsedMs: Date.now() - startedAt.getTime() });
    } catch {
      // Renderer progress must not break the run.
    }
  };

  emit({ phase: "environment", index: 0, message: "必要な環境を確認しています。", lastAction: "" });

  const child = spawn(config.exePath, config.launchArgs, {
    cwd: path.dirname(config.exePath),
    shell: false,
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let processOutput = "";
  const appendOutput = (chunk) => {
    processOutput = (processOutput + String(chunk || "")).slice(-12000);
  };
  child.stdout?.on("data", appendOutput);
  child.stderr?.on("data", appendOutput);
  child.on("error", (error) => appendOutput("launch error: " + String(error?.message || error)));

  emit({ phase: "launch", index: 0, message: "ゲームを起動し、ウィンドウを探しています。", lastAction: "exe起動" });

  let targetWindow;
  try {
    targetWindow = await waitForTargetWindow(openWindows, config, child.pid, abortController.signal);
    await ensureTargetForeground({ activeWindow, target: targetWindow, config, processId: child.pid });
  } catch (error) {
    abortController.abort();
    await releaseCommonKeys();
    activeRun = null;
    throw error;
  }

  const tests = [];
  let lastActionFingerprint = "";
  let repeatedActionCount = 0;
  let lastScreenshotHash = "";
  let unchangedScreenCount = 0;
  let currentReportedResult = null;
  let currentActionLog = [];

  class ScopedTestOperator extends NutJSOperator {
    static MANUAL = {
      ACTION_SPACES: [
        ...(NutJSOperator.MANUAL?.ACTION_SPACES || []),
        "report_pass(reason='短い確認内容', confidence='high|medium|low') # 成功条件を画面で確認できた場合だけ使う",
        "report_fail(reason='実際に確認した失敗内容', confidence='high|medium|low') # 期待と違う状態を画面で確認できた場合だけ使う",
        "report_warning(reason='問題の可能性', confidence='high|medium|low') # 動作はするが注意が必要な場合",
        "report_unknown(reason='判断できない理由') # 画面だけで判断できない場合"
      ]
    };

    async screenshot() {
      const current = await activeWindow();
      if (!targetMatches(current, config.exePath, config.windowTitle, child.pid)) {
        abortController.abort();
        throw new Error("テスト対象以外のウィンドウが前面になったため、安全停止しました。");
      }
      const shot = await super.screenshot();
      const hash = crypto.createHash("sha256").update(shot.base64).digest("hex");
      if (hash === lastScreenshotHash) unchangedScreenCount += 1;
      else unchangedScreenCount = 0;
      lastScreenshotHash = hash;
      if (unchangedScreenCount >= config.safety.unchangedScreenLimit) {
        abortController.abort();
        throw new Error("画面が変わらない状態が続いたため停止しました。");
      }
      return shot;
    }

    async execute(params) {
      const parsed = params?.parsedPrediction || {};
      const actionType = String(parsed.action_type || "");

      if (["report_pass", "report_fail", "report_warning", "report_unknown"].includes(actionType)) {
        currentReportedResult = {
          status: reportActionToStatus(actionType),
          actual: cleanText(parsed.action_inputs?.reason, 1200),
          confidence: actionType === "report_unknown"
            ? "unknown"
            : confidenceValue(parsed.action_inputs?.confidence)
        };
        return { status: StatusEnum.END };
      }

      const current = await activeWindow();
      if (!targetMatches(current, config.exePath, config.windowTitle, child.pid)) {
        abortController.abort();
        throw new Error("テスト対象以外のウィンドウへ操作しようとしたため、安全停止しました。");
      }

      if (blockedHotkey(params)) {
        abortController.abort();
        throw new Error("Windows全体へ影響するショートカットを検出したため、安全停止しました。");
      }

      if (isPointerAction(actionType)) {
        const bounds = current?.bounds || current?.contentBounds;
        if (bounds && parsed.action_inputs?.start_box) {
          const point = parseBoxToScreenCoords({
            boxStr: parsed.action_inputs.start_box,
            screenWidth: params.screenWidth,
            screenHeight: params.screenHeight
          });
          if (!pointInsideBounds(point, bounds)) {
            abortController.abort();
            throw new Error("ゲームウィンドウ外へのマウス操作を検出したため、安全停止しました。");
          }
        }
        if (bounds && parsed.action_inputs?.end_box) {
          const point = parseBoxToScreenCoords({
            boxStr: parsed.action_inputs.end_box,
            screenWidth: params.screenWidth,
            screenHeight: params.screenHeight
          });
          if (!pointInsideBounds(point, bounds)) {
            abortController.abort();
            throw new Error("ゲームウィンドウ外へのドラッグを検出したため、安全停止しました。");
          }
        }
      }

      const fingerprint = actionFingerprint(params);
      if (fingerprint === lastActionFingerprint) repeatedActionCount += 1;
      else repeatedActionCount = 0;
      lastActionFingerprint = fingerprint;
      if (repeatedActionCount >= config.safety.sameActionLimit) {
        abortController.abort();
        throw new Error("同じ操作を繰り返したため停止しました。");
      }

      const safeLog = sanitizeActionLog(params);
      currentActionLog.push(safeLog);
      emit({
        phase: "testing",
        message: "AIがゲームを操作しています。",
        lastAction: safeLog.type
      });
      return super.execute(params);
    }
  }

  const operator = new ScopedTestOperator();

  async function saveEvidence(name) {
    const shot = await operator.screenshot();
    const fileName = name.replace(/[^a-z0-9._-]+/gi, "-") + ".png";
    await fs.writeFile(path.join(evidenceDir, fileName), Buffer.from(shot.base64, "base64"));
    return "evidence/" + fileName;
  }

  try {
    for (let index = 0; index < selectedTests.length; index += 1) {
      const test = selectedTests[index];
      currentReportedResult = null;
      currentActionLog = [];
      lastActionFingerprint = "";
      repeatedActionCount = 0;
      lastScreenshotHash = "";
      unchangedScreenCount = 0;

      emit({
        phase: "testing",
        index: index + 1,
        testId: test.id,
        testName: test.name,
        message: "開始前の画面を保存しています。",
        lastAction: ""
      });

      let beforeScreenshot = "";
      let afterScreenshot = "";
      let failScreenshot = "";
      let status = "UNKNOWN";
      let actual = "";
      let confidence = "unknown";
      let errorMessage = "";
      const testStarted = Date.now();

      try {
        beforeScreenshot = await saveEvidence(`${String(index + 1).padStart(2, "0")}-${test.id}-before`);

        const instruction = [
          "あなたはGame Dev HubのWindowsゲーム自動テスト担当です。",
          "操作してよいのは現在前面にあるテスト対象ゲームだけです。Windows、他アプリ、ファイル、アカウント、GitHub、PowerShell、システム設定を操作してはいけません。",
          "画面で確認できた事実だけで判定してください。推測でPASS/FAILにしないでください。",
          "",
          "テスト: " + test.name,
          "やること: " + (test.description || test.name),
          "成功条件: " + (test.expected || "指定した操作が期待どおり動作すること"),
          "",
          "確認後は必ず report_pass / report_fail / report_warning / report_unknown のどれか1つで終了してください。",
          "判断できない場合は report_unknown を使ってください。finished()だけで終了しないでください。"
        ].join("\n");

        const agentController = new AbortController();
        const relayAbort = () => agentController.abort();
        abortController.signal.addEventListener("abort", relayAbort, { once: true });
        const timeoutMs = Math.min(config.timeout, test.timeout) * 1000;
        const timeoutTimer = setTimeout(() => agentController.abort(), timeoutMs);

        const guiAgent = new GUIAgent({
          model: {
            baseURL: config.model.baseURL,
            apiKey: apiKey || "local",
            model: config.model.name
          },
          operator,
          signal: agentController.signal,
          maxLoopCount: config.maxAgentSteps,
          onData: ({ data }) => {
            const last = data?.conversations?.[data.conversations.length - 1];
            const action = last?.predictionParsed?.action_type;
            if (action) {
              emit({
                phase: "testing",
                index: index + 1,
                testId: test.id,
                testName: test.name,
                message: "AIが画面を確認しています。",
                lastAction: String(action)
              });
            }
          },
          onError: ({ error }) => {
            errorMessage = cleanText(error?.message || error, 600);
          }
        });

        try {
          await guiAgent.run(instruction);
        } finally {
          clearTimeout(timeoutTimer);
          abortController.signal.removeEventListener("abort", relayAbort);
        }

        if (currentReportedResult) {
          ({ status, actual, confidence } = currentReportedResult);
        } else if (agentController.signal.aborted) {
          status = abortController.signal.aborted ? "UNKNOWN" : "WARNING";
          actual = abortController.signal.aborted
            ? "AI操作が安全停止または緊急停止されました。"
            : "テスト時間を超えました。";
          confidence = "unknown";
        } else {
          status = "UNKNOWN";
          actual = errorMessage || "AIが明示的な判定を返しませんでした。";
        }

        afterScreenshot = await saveEvidence(`${String(index + 1).padStart(2, "0")}-${test.id}-after`);
        if (status === "FAIL") {
          failScreenshot = await saveEvidence(`${String(index + 1).padStart(2, "0")}-${test.id}-fail`);
        }
      } catch (error) {
        status = "UNKNOWN";
        actual = "テストを最後まで実行できませんでした。";
        errorMessage = cleanText(error?.message || error, 600);
        confidence = "unknown";
        try {
          failScreenshot = await saveEvidence(`${String(index + 1).padStart(2, "0")}-${test.id}-error`);
        } catch {
          // A safety violation can intentionally make screenshots unavailable.
        }
      }

      const reproduction = status === "FAIL"
        ? currentActionLog.map((entry, actionIndex) => `${actionIndex + 1}. ${entry.type}`).join("\n")
        : "";

      tests.push({
        id: test.id,
        name: test.name,
        description: test.description,
        expected: test.expected,
        status: AUTO_TEST_STATUSES.has(status) ? status : "UNKNOWN",
        actual,
        confidence,
        durationMs: Date.now() - testStarted,
        screenshots: {
          before: beforeScreenshot,
          after: afterScreenshot,
          failure: failScreenshot
        },
        actionLog: currentActionLog,
        error: errorMessage,
        reproduction
      });

      emit({
        phase: "testing",
        index: index + 1,
        testId: test.id,
        testName: test.name,
        message: test.name + " → " + status,
        lastAction: ""
      });

      if (abortController.signal.aborted) break;
    }
  } finally {
    await releaseCommonKeys();
  }

  const count = (value) => tests.filter((test) => test.status === value).length;
  const report = {
    schemaVersion: 1,
    project: project.name,
    projectId: project.id,
    testRunId: runId,
    engine: "UI-TARS",
    testedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    targetExe: path.basename(config.exePath),
    targetVersion: config.targetVersion,
    gitCommit,
    appVersion,
    stopped: abortController.signal.aborted,
    stopReason: activeRun?.stopReason || "",
    summary: {
      total: tests.length,
      passed: count("PASS"),
      failed: count("FAIL"),
      warning: count("WARNING"),
      unknown: count("UNKNOWN")
    },
    tests,
    processLog: cleanText(processOutput, 12000),
    safety: {
      targetWindowOnly: true,
      emergencyShortcut: config.safety.emergencyShortcut,
      apiKeyPersisted: false,
      externalSendAutomatic: false
    }
  };

  const saved = await saveAutoTestReport(userDataPath, project.id, report);
  activeRun = null;
  emit({ phase: "complete", index: tests.length, message: "AIテスト結果を保存しました。", lastAction: "" });
  return { report, runDir: saved.runDir, summary: saved.summary };
}
