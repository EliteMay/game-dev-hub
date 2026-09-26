import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Jimp } from "jimp";
import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

export const AI_TEST_CONFIG_VERSION = 1;
export const AI_TEST_REPORT_VERSION = 1;
export const AI_TEST_STATUSES = Object.freeze(["PASS", "FAIL", "WARNING", "UNKNOWN"]);
export const AI_TEST_ENGINES = Object.freeze(["ui-tars", "agent-s", "disabled"]);

export const DEFAULT_AI_TESTS = Object.freeze([
  {
    id: "game_launch",
    name: "ゲーム起動",
    description: "指定されたゲーム.exeを起動し、対象ウィンドウが表示されることを確認する",
    expected: "ゲームウィンドウが表示され、操作可能な状態になる",
    timeout: 30,
    enabled: true
  },
  {
    id: "wasd_move",
    name: "WASD移動",
    description: "W/A/S/Dを使って短時間移動し、画面上の変化を確認する",
    expected: "プレイヤー、カメラ、座標など移動を示す画面変化が確認できる",
    timeout: 45,
    enabled: true
  },
  {
    id: "mouse_click",
    name: "マウス操作",
    description: "ゲーム画面内の安全な操作対象を1つクリックする",
    expected: "クリックに応じたUIまたはゲーム状態の変化が確認できる",
    timeout: 45,
    enabled: true
  }
]);

const MAX_TESTS = 60;
const MAX_HISTORY = 100;
const MAX_TEXT = 2000;
const MAX_ACTION_LOG = 240;
const SAFE_KEY_NAMES = new Set([
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  "up", "down", "left", "right",
  "space", "shift", "ctrl", "esc", "enter", "tab", "backspace",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
]);

const SAFE_ACTION_TYPES = new Set([
  "wait",
  "mouse_move",
  "hover",
  "click",
  "left_click",
  "left_single",
  "left_double",
  "double_click",
  "right_click",
  "right_single",
  "drag",
  "left_click_drag",
  "select",
  "scroll",
  "hotkey",
  "press",
  "release",
  "finished",
  "call_user",
  "user_stop",
  "error_env"
]);

const KEY_ACTION_TYPES = new Set(["hotkey", "press", "release"]);

const KEY_ALIASES = new Map([
  ["control", "ctrl"],
  ["leftcontrol", "ctrl"],
  ["rightcontrol", "ctrl"],
  ["leftctrl", "ctrl"],
  ["rightctrl", "ctrl"],
  ["leftshift", "shift"],
  ["rightshift", "shift"],
  ["escape", "esc"],
  ["return", "enter"],
  ["arrowup", "up"],
  ["arrowdown", "down"],
  ["arrowleft", "left"],
  ["arrowright", "right"]
]);

function text(value, max = MAX_TEXT) {
  return String(value ?? "").trim().slice(0, max);
}

function finiteTimeout(value, fallback = 60) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(600, Math.max(5, Math.round(number))) : fallback;
}

function safeProjectId(projectId) {
  const value = String(projectId ?? "");
  if (!/^[a-z0-9-]{1,100}$/.test(value)) {
    throw new Error("Game IDが正しくありません。");
  }
  return value;
}

function safeRunId(runId) {
  const value = String(runId ?? "");
  if (!/^[0-9TZ._-]{10,80}$/.test(value)) {
    throw new Error("Test Run IDが正しくありません。");
  }
  return value;
}

function aiRoot(dataRoot) {
  return path.join(dataRoot, "ai-testing");
}

function configPath(dataRoot, projectId) {
  return path.join(aiRoot(dataRoot), "projects", safeProjectId(projectId) + ".json");
}

function runsRoot(dataRoot, projectId) {
  return path.join(aiRoot(dataRoot), "runs", safeProjectId(projectId));
}

function runRoot(dataRoot, projectId, runId) {
  return path.join(runsRoot(dataRoot, projectId), safeRunId(runId));
}

export function sanitizeAiTestDefinition(value = {}, index = 0) {
  const fallback = DEFAULT_AI_TESTS[index] || {
    id: "test_" + (index + 1),
    name: "テスト " + (index + 1),
    description: "",
    expected: "",
    timeout: 60,
    enabled: true
  };

  const rawId = text(value.id || fallback.id, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return {
    id: rawId || fallback.id,
    name: text(value.name || fallback.name, 120),
    description: text(value.description || fallback.description),
    expected: text(value.expected || fallback.expected),
    timeout: finiteTimeout(value.timeout, fallback.timeout),
    enabled: value.enabled !== false
  };
}

export function sanitizeAiTestConfig(value = {}, defaults = {}) {
  const rawTests = Array.isArray(value.tests) ? value.tests.slice(0, MAX_TESTS) : DEFAULT_AI_TESTS;
  const tests = rawTests.map((item, index) => sanitizeAiTestDefinition(item, index));
  const seen = new Set();
  const uniqueTests = tests.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const engine = AI_TEST_ENGINES.includes(value.engine) ? value.engine : "ui-tars";
  const exePath = typeof value.exePath === "string" && path.isAbsolute(value.exePath.trim())
    ? value.exePath.trim()
    : (typeof defaults.exePath === "string" ? defaults.exePath : "");
  const screenshotDirectory = typeof value.screenshotDirectory === "string" &&
    value.screenshotDirectory.trim() &&
    path.isAbsolute(value.screenshotDirectory.trim())
      ? value.screenshotDirectory.trim()
      : "";

  const launchArgs = Array.isArray(value.launchArgs)
    ? value.launchArgs
        .filter((item) => typeof item === "string")
        .map((item) => item.slice(0, 300))
        .slice(0, 20)
    : [];

  return {
    version: AI_TEST_CONFIG_VERSION,
    exePath,
    launchArgs,
    windowTitle: text(value.windowTitle || defaults.windowTitle || "", 180),
    targetVersion: text(value.targetVersion || "", 100),
    engine,
    timeout: finiteTimeout(value.timeout, 60),
    screenshotDirectory,
    uiTars: {
      baseUrl: text(value.uiTars?.baseUrl || "http://127.0.0.1:1234/v1", 500),
      model: text(value.uiTars?.model || "ui-tars-1.5", 180)
    },
    tests: uniqueTests.length ? uniqueTests : DEFAULT_AI_TESTS.map((item) => ({ ...item }))
  };
}

export async function loadAiTestConfig(dataRoot, projectId, defaults = {}) {
  const filePath = configPath(dataRoot, projectId);
  const loaded = await readJsonRecovering(filePath, {});
  const safe = sanitizeAiTestConfig(loaded.value, defaults);
  if (JSON.stringify(loaded.value) !== JSON.stringify(safe)) {
    await writeJsonAtomic(filePath, safe);
  }
  return safe;
}

export async function saveAiTestConfig(dataRoot, projectId, value, defaults = {}) {
  const safe = sanitizeAiTestConfig(value, defaults);
  await writeJsonAtomic(configPath(dataRoot, projectId), safe);
  return safe;
}

export function makeTestRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function summarizeAiTestResults(tests = []) {
  const summary = { total: tests.length, passed: 0, failed: 0, warning: 0, unknown: 0 };
  for (const test of tests) {
    if (test.status === "PASS") summary.passed += 1;
    else if (test.status === "FAIL") summary.failed += 1;
    else if (test.status === "WARNING") summary.warning += 1;
    else summary.unknown += 1;
  }
  return summary;
}

export function normalizeConfidence(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "high" || normalized === "高") return "high";
  if (normalized === "medium" || normalized === "中") return "medium";
  return "low";
}

export function parseUiTarsFinished(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const jsonMatch = source.match(/\{\s*["']?status["']?\s*:\s*["']?(PASS|FAIL|WARNING|UNKNOWN)["']?[\s\S]*?\}/i);
  if (!jsonMatch) {
    return {
      status: "UNKNOWN",
      actual: "",
      reason: "AIから機械可読な最終判定を取得できませんでした。",
      confidence: "low"
    };
  }

  const candidate = jsonMatch[0]
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:/g, '$1"$2":');

  try {
    const parsed = JSON.parse(candidate);
    const status = AI_TEST_STATUSES.includes(String(parsed.status).toUpperCase())
      ? String(parsed.status).toUpperCase()
      : "UNKNOWN";
    return {
      status,
      actual: text(parsed.actual || parsed.result || "", 1500),
      reason: text(parsed.reason || parsed.explanation || "", 1500),
      confidence: normalizeConfidence(parsed.confidence)
    };
  } catch {
    return {
      status: String(jsonMatch[1]).toUpperCase(),
      actual: "",
      reason: "最終判定の詳細JSONを完全には解析できませんでした。",
      confidence: "low"
    };
  }
}

export function computerActionSource(action) {
  if (typeof action === "string") return action;
  if (!action || typeof action !== "object") return "";

  const parsed = action.parsedPrediction;
  if (parsed && typeof parsed === "object") {
    return JSON.stringify({
      action_type: parsed.action_type || "",
      action_inputs: parsed.action_inputs || {}
    });
  }

  if (typeof action.prediction === "string") return action.prediction;
  return JSON.stringify(action);
}

function parsedComputerAction(action) {
  if (action && typeof action === "object" && action.parsedPrediction) {
    const parsed = action.parsedPrediction;
    return {
      type: String(parsed.action_type || "").trim().toLowerCase(),
      inputs: parsed.action_inputs && typeof parsed.action_inputs === "object"
        ? parsed.action_inputs
        : {},
      source: computerActionSource(action)
    };
  }

  const source = computerActionSource(action);
  const match = source.match(/^\s*([a-z_]+)\s*\(/i);
  return {
    type: String(match?.[1] || "").toLowerCase(),
    inputs: {},
    source
  };
}

function normalizeKeyName(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  return KEY_ALIASES.get(key) || key;
}

function keyNamesForAction(action, parsed) {
  const raw = parsed.inputs?.key ?? parsed.inputs?.hotkey ?? parsed.inputs?.keys;
  if (Array.isArray(raw)) {
    return raw.map(normalizeKeyName).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[+\s]+/)
      .map(normalizeKeyName)
      .filter(Boolean);
  }

  const words = parsed.source.toLowerCase().match(/[a-z0-9]+/g) || [];
  return words
    .filter((word) =>
      ![
        "action", "type", "inputs", "press", "release", "key", "hotkey", "keys",
        "duration", "seconds", "second", "down", "up"
      ].includes(word) &&
      !/^\d+(?:ms)?$/.test(word)
    )
    .map(normalizeKeyName)
    .filter(Boolean);
}

function isBlockedSystemShortcut(keys) {
  const set = new Set(keys);
  return (
    (set.has("ctrl") && set.has("shift") && set.has("esc")) ||
    (set.has("alt") && set.has("tab")) ||
    ((set.has("windows") || set.has("win") || set.has("meta")) && set.has("r")) ||
    (set.has("ctrl") && set.has("alt") && (set.has("delete") || set.has("del")))
  );
}

export function validateComputerAction(action) {
  const parsed = parsedComputerAction(action);
  if (!SAFE_ACTION_TYPES.has(parsed.type)) {
    return { ok: false, reason: "許可されていないComputer Use操作です。" };
  }

  if (KEY_ACTION_TYPES.has(parsed.type)) {
    const keys = keyNamesForAction(action, parsed);
    if (!keys.length) {
      return { ok: false, reason: "キー入力の内容を確認できません。" };
    }
    if (isBlockedSystemShortcut(keys)) {
      return { ok: false, reason: "システムShortcutは許可されていません。" };
    }
    if (keys.some((key) => !SAFE_KEY_NAMES.has(key))) {
      return { ok: false, reason: "許可されていないキー入力です。" };
    }
  }

  if (parsed.type === "scroll") {
    const direction = String(parsed.inputs?.direction || "").toLowerCase();
    if (direction && !["up", "down"].includes(direction)) {
      return { ok: false, reason: "許可されていないスクロール方向です。" };
    }
  }

  return { ok: true, reason: "" };
}

export function normalizeMaskRegion(region, imageWidth, imageHeight) {
  const width = Math.max(1, Math.floor(Number(imageWidth) || 0));
  const height = Math.max(1, Math.floor(Number(imageHeight) || 0));
  const left = Math.max(0, Math.min(width, Math.floor(Number(region?.left ?? region?.x ?? 0))));
  const top = Math.max(0, Math.min(height, Math.floor(Number(region?.top ?? region?.y ?? 0))));
  const right = Math.max(
    left,
    Math.min(width, Math.ceil(left + Math.max(0, Number(region?.width) || 0)))
  );
  const bottom = Math.max(
    top,
    Math.min(height, Math.ceil(top + Math.max(0, Number(region?.height) || 0)))
  );

  if (right <= left || bottom <= top) {
    throw new Error("AI_TEST_SCREEN_MASK_FAILED");
  }

  return { left, top, right, bottom };
}

export async function maskScreenshotToWindow(screenshot, region) {
  if (!screenshot?.base64) throw new Error("AI_TEST_SCREEN_MASK_FAILED");

  const image = await Jimp.read(Buffer.from(screenshot.base64, "base64"));
  const bounds = normalizeMaskRegion(region, image.bitmap.width, image.bitmap.height);
  const { data, width, height } = image.bitmap;

  image.scan(0, 0, width, height, (x, y, index) => {
    const visible =
      x >= bounds.left &&
      x < bounds.right &&
      y >= bounds.top &&
      y < bounds.bottom;
    if (!visible) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  });

  const png = await image.getBuffer("image/png");
  return {
    ...screenshot,
    base64: png.toString("base64")
  };
}

export function buildUiTarsTestPrompt(test, context = {}) {
  return [
    "あなたはGame Dev HubのWindowsゲーム専用テスト担当です。",
    "操作対象は指定されたテスト対象ゲームのウィンドウだけです。",
    "ファイル操作、PowerShell/Terminal、GitHub操作、外部送信、購入、パスワード入力、管理者権限、Windows設定変更は禁止です。",
    "別アプリへ移動しないでください。判断できない場合は推測せずUNKNOWNにしてください。",
    "",
    "テスト名: " + test.name,
    "何をするか: " + test.description,
    "成功条件: " + test.expected,
    context.windowTitle ? "対象ウィンドウ: " + context.windowTitle : "",
    "",
    "必要な範囲でWASD、Space、Shift、Ctrl、Esc、Enter、数字キー、マウス移動/クリック/ドラッグ/スクロールだけを使ってください。",
    "テスト終了時は必ず finished(content='{\"status\":\"PASS|FAIL|WARNING|UNKNOWN\",\"actual\":\"実際に確認できた内容\",\"confidence\":\"high|medium|low\",\"reason\":\"根拠\"}') の形式で終了してください。",
    "画面から確認できない値を作らないでください。"
  ].filter(Boolean).join("\n");
}

export async function inspectUiTarsDependencies() {
  const result = {
    sdk: false,
    operator: false,
    nutJs: false,
    error: ""
  };

  try {
    await import("@ui-tars/sdk");
    result.sdk = true;
  } catch (error) {
    result.error = "UI-TARS SDKを読み込めません: " + text(error?.message, 240);
  }

  try {
    await import("@ui-tars/operator-nut-js");
    result.operator = true;
  } catch (error) {
    if (!result.error) result.error = "UI-TARS NutJS Operatorを読み込めません: " + text(error?.message, 240);
  }

  try {
    await import("@computer-use/nut-js");
    result.nutJs = true;
  } catch (error) {
    if (!result.error) result.error = "Computer Use入力基盤を読み込めません: " + text(error?.message, 240);
  }

  return result;
}

export async function inspectExecutable(exePath) {
  if (!exePath || !path.isAbsolute(exePath) || path.extname(exePath).toLowerCase() !== ".exe") {
    return { ok: false, code: "EXE_INVALID", message: "テスト対象の.exeを設定してください。" };
  }

  try {
    const stat = await fs.stat(exePath);
    if (!stat.isFile()) throw new Error("not-file");
    return { ok: true };
  } catch {
    return { ok: false, code: "EXE_MISSING", message: "設定されたゲーム.exeが見つかりません。" };
  }
}

export async function launchTestExecutable(config) {
  const executable = await inspectExecutable(config.exePath);
  if (!executable.ok) {
    const error = new Error(executable.message);
    error.code = executable.code;
    throw error;
  }

  const child = spawn(config.exePath, config.launchArgs || [], {
    cwd: path.dirname(config.exePath),
    windowsHide: false,
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  const logs = [];
  const append = (stream, prefix) => {
    stream?.on("data", (chunk) => {
      const line = text(chunk.toString("utf8"), 1200);
      if (line) logs.push(prefix + line);
      if (logs.length > 120) logs.shift();
    });
  };
  append(child.stdout, "stdout: ");
  append(child.stderr, "stderr: ");

  return { child, logs };
}

export async function findAndFocusTargetWindow(windowTitle, timeoutMs = 15000, signal) {
  const expected = text(windowTitle, 180).toLowerCase();
  if (!expected) {
    return { ok: false, code: "WINDOW_TITLE_REQUIRED", message: "ゲームのウィンドウ名を設定してください。" };
  }

  const nut = await import("@computer-use/nut-js");
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) return { ok: false, code: "ABORTED", message: "AI操作を停止しました。" };
    const windows = await nut.getWindows();
    for (const item of windows) {
      let title = "";
      try {
        title = await item.title;
        if (typeof title !== "string" && typeof item.getTitle === "function") title = await item.getTitle();
      } catch {
        title = "";
      }
      if (String(title).toLowerCase().includes(expected)) {
        if (typeof item.focus === "function") await item.focus();
        return { ok: true, window: item, title: String(title) };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return {
    ok: false,
    code: "WINDOW_NOT_FOUND",
    message: "指定したゲームウィンドウを検出できませんでした。"
  };
}

async function activeWindowContext() {
  const nut = await import("@computer-use/nut-js");
  const current = await nut.getActiveWindow();

  let title = "";
  try {
    title = await current.title;
  } catch {
    if (typeof current.getTitle === "function") {
      title = String(await current.getTitle());
    }
  }

  let region = null;
  try {
    region = await current.region;
  } catch {
    if (typeof current.getRegion === "function") {
      region = await current.getRegion();
    }
  }

  return { title: String(title || ""), region };
}

function targetWindowAllowed(actualTitle, allowedTitles) {
  const titleLower = String(actualTitle).toLowerCase();
  return allowedTitles.some((allowed) => {
    const value = text(allowed, 180).toLowerCase();
    return value && titleLower.includes(value);
  });
}

export async function runUiTarsTest({
  config,
  test,
  apiKey,
  allowedWindowTitles,
  signal,
  onProgress = () => {}
}) {
  const { GUIAgent } = await import("@ui-tars/sdk");
  const { NutJSOperator } = await import("@ui-tars/operator-nut-js");

  const localController = new AbortController();
  const effectiveSignal = localController.signal;
  const forwardAbort = () => localController.abort(signal?.reason || "parent-abort");
  if (signal?.aborted) {
    forwardAbort();
  } else {
    signal?.addEventListener("abort", forwardAbort, { once: true });
  }

  const rawOperator = new NutJSOperator();
  const actions = [];
  let repeated = 0;
  let lastAction = "";

  const safeOperator = new Proxy(rawOperator, {
    get(target, property) {
      const value = target[property];

      if (property === "screenshot" && typeof value === "function") {
        return async (...args) => {
          if (effectiveSignal.aborted) throw new Error("AI_TEST_ABORTED");

          const active = await activeWindowContext();
          if (!targetWindowAllowed(active.title, allowedWindowTitles) || !active.region) {
            throw new Error("AI_TEST_WINDOW_SCOPE_VIOLATION");
          }

          const screenshot = await value.apply(target, args);
          try {
            return await maskScreenshotToWindow(screenshot, active.region);
          } catch {
            throw new Error("AI_TEST_SCREEN_MASK_FAILED");
          }
        };
      }

      if (property !== "execute" || typeof value !== "function") {
        return typeof value === "function" ? value.bind(target) : value;
      }

      return async (...args) => {
        if (effectiveSignal.aborted) throw new Error("AI_TEST_ABORTED");
        const action = args[0];
        const validation = validateComputerAction(action);
        if (!validation.ok) throw new Error("AI_TEST_BLOCKED_ACTION: " + validation.reason);

        const active = await activeWindowContext();
        if (!targetWindowAllowed(active.title, allowedWindowTitles)) {
          throw new Error("AI_TEST_WINDOW_SCOPE_VIOLATION");
        }

        const actionText = text(computerActionSource(action), 500);
        repeated = actionText === lastAction ? repeated + 1 : 0;
        lastAction = actionText;
        if (repeated >= 4) throw new Error("AI_TEST_STUCK_REPEAT");

        actions.push({
          at: new Date().toISOString(),
          action: actionText,
          windowTitle: text(active.title, 180)
        });
        if (actions.length > MAX_ACTION_LOG) actions.shift();

        onProgress({
          phase: "action",
          message: "AIがゲームを操作しています",
          action: actionText
        });
        return value.apply(target, args);
      };
    }
  });

  let lastData = "";
  const agent = new GUIAgent({
    model: {
      baseURL: config.uiTars.baseUrl,
      apiKey: apiKey || "local",
      model: config.uiTars.model
    },
    operator: safeOperator,
    signal: effectiveSignal,
    onData: ({ data }) => {
      const serialized = text(typeof data === "string" ? data : JSON.stringify(data), 5000);
      if (serialized) lastData = serialized;
      onProgress({
        phase: "thinking",
        message: "AIが画面を確認しています"
      });
    },
    onError: ({ error }) => {
      onProgress({
        phase: "warning",
        message: "UI-TARS: " + text(error?.message || error, 240)
      });
    }
  });

  const prompt = buildUiTarsTestPrompt(test, { windowTitle: config.windowTitle });
  const runPromise = agent.run(prompt);
  const timeoutMs = finiteTimeout(test.timeout, config.timeout) * 1000;
  let timeoutId;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        localController.abort("timeout");
        reject(new Error("AI_TEST_TIMEOUT"));
      }, timeoutMs);
    });
    const result = await Promise.race([runPromise, timeoutPromise]);
    const parsed = parseUiTarsFinished(lastData || result);
    return { ...parsed, actions };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardAbort);
    if (!effectiveSignal.aborted) localController.abort("test-finished");
  }
}

export function buildReproductionSteps(actions = []) {
  if (!actions.length) return [];
  return actions.slice(0, 30).map((item, index) =>
    String(index + 1) + ". " + text(item.action, 300)
  );
}

export async function saveAiTestReport(dataRoot, projectId, report) {
  const dir = runRoot(dataRoot, projectId, report.testRunId);
  await fs.mkdir(dir, { recursive: true });
  const safe = {
    ...report,
    schemaVersion: AI_TEST_REPORT_VERSION,
    summary: summarizeAiTestResults(report.tests || [])
  };
  await writeJsonAtomic(path.join(dir, "report.json"), safe);
  return { report: safe, runDirectory: dir };
}

export async function loadAiTestReport(dataRoot, projectId, runId) {
  const loaded = await readJsonRecovering(
    path.join(runRoot(dataRoot, projectId, runId), "report.json"),
    null
  );
  return loaded.value && typeof loaded.value === "object" ? loaded.value : null;
}

export async function listAiTestHistory(dataRoot, projectId, limit = 20) {
  const dir = runsRoot(dataRoot, projectId);
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(0, Math.min(MAX_HISTORY, Math.max(1, limit)));

  const history = [];
  for (const runId of runIds) {
    try {
      const report = await loadAiTestReport(dataRoot, projectId, runId);
      if (!report) continue;
      history.push({
        testRunId: report.testRunId,
        startedAt: report.startedAt,
        completedAt: report.completedAt,
        engine: report.engine,
        commit: report.gitCommit || "",
        summary: report.summary || summarizeAiTestResults(report.tests || []),
        mode: report.mode || "fixed"
      });
    } catch {
      // Ignore incomplete/corrupt historical runs.
    }
  }
  return history;
}

export async function latestAiTestReport(dataRoot, projectId) {
  const history = await listAiTestHistory(dataRoot, projectId, 1);
  if (!history.length) return null;
  return loadAiTestReport(dataRoot, projectId, history[0].testRunId);
}
