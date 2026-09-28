import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Jimp } from "jimp";
import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

export const AI_TEST_CONFIG_VERSION = 4;
export const AI_TEST_REPORT_VERSION = 1;
export const AI_TEST_STATUSES = Object.freeze(["PASS", "FAIL", "WARNING", "UNKNOWN"]);
export const AI_TEST_ENGINES = Object.freeze(["ui-tars", "agent-s", "disabled"]);
export const DEFAULT_UI_TARS_MODEL = "ui-tars-1.5-7b";
export const LEGACY_UI_TARS_MODEL = "ui-tars-1.5";

export const DEFAULT_AI_TESTS = Object.freeze([
  {
    id: "game_launch",
    name: "ゲーム起動",
    description: "指定されたゲームまたはGodot開発実行を起動し、対象ウィンドウが表示されることを確認する",
    expected: "ゲームウィンドウが表示され、操作可能な状態になる",
    timeout: 30,
    enabled: true
  },
  {
    id: "wasd_move",
    name: "WASD移動",
    description: "Wキーを短時間入力し、Runtime Test BridgeのPlayer座標変化を確認する",
    expected: "Player positionが入力前後で変化し、移動入力がRuntime上で反映される",
    timeout: 120,
    enabled: true
  },
  {
    id: "mouse_click",
    name: "マウス視点",
    description: "マウスを右方向へ小さく動かし、Runtime Test BridgeのCamera角度変化を確認する",
    expected: "Camera yawまたはpitchが入力前後で変化し、マウスルックがRuntime上で反映される",
    timeout: 120,
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
  const sourceVersion = Number(value.version) || 1;
  const rawTests = Array.isArray(value.tests) ? value.tests.slice(0, MAX_TESTS) : DEFAULT_AI_TESTS;
  const tests = rawTests.map((item, index) => {
    const safe = sanitizeAiTestDefinition(item, index);
    let migrated = { ...safe };

    if (
      sourceVersion < 2 &&
      (migrated.id === "wasd_move" || migrated.id === "mouse_click") &&
      migrated.timeout === 45
    ) {
      migrated.timeout = 120;
    }

    if (
      sourceVersion < 3 &&
      migrated.id === "mouse_click" &&
      migrated.name === "マウス操作" &&
      migrated.description === "ゲーム画面内の安全な操作対象を1つクリックする" &&
      migrated.expected === "クリックに応じたUIまたはゲーム状態の変化が確認できる"
    ) {
      migrated = {
        ...migrated,
        name: "マウス視点",
        description: "マウスを右方向へ小さく動かし、ゲーム内の視点変化を確認する",
        expected: "カメラまたは背景の見え方が変化し、マウスルックが反応していることを確認できる"
      };
    }

    if (
      sourceVersion < 4 &&
      migrated.id === "wasd_move" &&
      migrated.description === "W/A/S/Dを使って短時間移動し、画面上の変化を確認する" &&
      migrated.expected === "プレイヤー、カメラ、座標など移動を示す画面変化が確認できる"
    ) {
      migrated = {
        ...migrated,
        description: "Wキーを短時間入力し、Runtime Test BridgeのPlayer座標変化を確認する",
        expected: "Player positionが入力前後で変化し、移動入力がRuntime上で反映される"
      };
    }

    if (
      sourceVersion < 4 &&
      migrated.id === "mouse_click" &&
      migrated.name === "マウス視点" &&
      migrated.description === "マウスを右方向へ小さく動かし、ゲーム内の視点変化を確認する" &&
      migrated.expected === "カメラまたは背景の見え方が変化し、マウスルックが反応していることを確認できる"
    ) {
      migrated = {
        ...migrated,
        description: "マウスを右方向へ小さく動かし、Runtime Test BridgeのCamera角度変化を確認する",
        expected: "Camera yawまたはpitchが入力前後で変化し、マウスルックがRuntime上で反映される"
      };
    }

    return migrated;
  });
  const seen = new Set();
  const uniqueTests = tests.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const engine = AI_TEST_ENGINES.includes(value.engine) ? value.engine : "ui-tars";
  const explicitExePath = typeof value.exePath === "string" &&
    value.exePath.trim() &&
    path.isAbsolute(value.exePath.trim())
      ? value.exePath.trim()
      : "";
  const exePath = explicitExePath ||
    (typeof defaults.exePath === "string" && path.isAbsolute(defaults.exePath)
      ? defaults.exePath
      : "");
  const screenshotDirectory = typeof value.screenshotDirectory === "string" &&
    value.screenshotDirectory.trim() &&
    path.isAbsolute(value.screenshotDirectory.trim())
      ? value.screenshotDirectory.trim()
      : "";

  const launchArgsSource = explicitExePath
    ? value.launchArgs
    : (Array.isArray(defaults.launchArgs) ? defaults.launchArgs : value.launchArgs);
  const launchArgs = Array.isArray(launchArgsSource)
    ? launchArgsSource
        .filter((item) => typeof item === "string")
        .map((item) => item.slice(0, 300))
        .slice(0, 20)
    : [];

  return {
    version: AI_TEST_CONFIG_VERSION,
    exePath,
    launchArgs,
    windowTitle: text(value.windowTitle || defaults.windowTitle || "", 180),
    targetVersion: text(value.targetVersion || defaults.targetVersion || "", 100),
    engine,
    timeout: finiteTimeout(value.timeout, 60),
    screenshotDirectory,
    uiTars: {
      baseUrl: text(value.uiTars?.baseUrl || "http://127.0.0.1:1234/v1", 500),
      model: text(value.uiTars?.model || DEFAULT_UI_TARS_MODEL, 180)
    },
    tests: uniqueTests.length ? uniqueTests : DEFAULT_AI_TESTS.map((item) => ({ ...item }))
  };
}

export function buildOpenAiModelsUrl(baseUrl) {
  let target;
  try {
    target = new URL(String(baseUrl || ""));
  } catch {
    throw new Error("Base URLが正しくありません。");
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("Base URLはHTTP/HTTPSで指定してください。");
  }

  const basePath = target.pathname.replace(/\/+$/, "");
  target.pathname = (basePath || "") + "/models";
  target.search = "";
  target.hash = "";
  return target.toString();
}

export function resolveUiTarsModelId(configuredModel, models = []) {
  const expected = String(configuredModel || "").trim();
  const available = Array.isArray(models)
    ? models.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!expected) {
    return {
      matched: false,
      resolvedModel: "",
      matchType: "missing"
    };
  }

  const exact = available.find((item) => item === expected);
  if (exact) {
    return {
      matched: true,
      resolvedModel: exact,
      matchType: "exact"
    };
  }

  const caseInsensitive = available.find(
    (item) => item.toLowerCase() === expected.toLowerCase()
  );
  if (caseInsensitive) {
    return {
      matched: true,
      resolvedModel: caseInsensitive,
      matchType: "case-insensitive"
    };
  }

  if (expected.toLowerCase() === LEGACY_UI_TARS_MODEL) {
    const candidates = available.filter((item) =>
      item.toLowerCase().startsWith(LEGACY_UI_TARS_MODEL + "-")
    );
    if (candidates.length === 1) {
      return {
        matched: true,
        resolvedModel: candidates[0],
        matchType: "legacy-alias"
      };
    }
  }

  return {
    matched: false,
    resolvedModel: "",
    matchType: "none"
  };
}

export async function probeOpenAiModelEndpoint({
  baseUrl,
  model,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 4000
} = {}) {
  let modelsUrl;
  try {
    modelsUrl = buildOpenAiModelsUrl(baseUrl);
  } catch (error) {
    return {
      ok: false,
      endpointOk: false,
      modelFound: null,
      models: [],
      detail: String(error?.message || error)
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      endpointOk: false,
      modelFound: null,
      models: [],
      detail: "HTTP接続機能を利用できません。"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("diagnostic-timeout"), Math.max(250, Number(timeoutMs) || 4000));

  try {
    const headers = { accept: "application/json" };
    if (apiKey) headers.authorization = "Bearer " + apiKey;

    const response = await fetchImpl(modelsUrl, {
      method: "GET",
      redirect: "manual",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        endpointOk: false,
        modelFound: null,
        models: [],
        status: response.status,
        detail: "Model一覧を取得できませんでした（HTTP " + response.status + "）。"
      };
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        endpointOk: true,
        modelFound: null,
        models: [],
        status: response.status,
        detail: "Endpointへ接続できましたが、Model一覧をJSONとして確認できませんでした。"
      };
    }

    const models = Array.isArray(payload?.data)
      ? payload.data
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
          .slice(0, 100)
      : [];
    const expected = String(model || "").trim();
    const resolution = resolveUiTarsModelId(expected, models);
    const modelFound = expected ? resolution.matched : null;

    if (!models.length) {
      return {
        ok: false,
        endpointOk: true,
        modelFound: null,
        models,
        status: response.status,
        detail: "Endpointへ接続できましたが、利用可能なModel名を確認できませんでした。"
      };
    }

    if (modelFound === false) {
      return {
        ok: false,
        endpointOk: true,
        modelFound: false,
        models,
        resolvedModel: "",
        modelMatch: resolution.matchType,
        status: response.status,
        detail:
          "接続先は応答していますが、設定Model「" + expected +
          "」は読み込まれていません。利用可能: " + models.slice(0, 6).join(", ")
      };
    }

    const resolvedModel = resolution.resolvedModel || expected;
    const aliasResolved = resolution.matchType === "legacy-alias";

    return {
      ok: modelFound === true,
      endpointOk: true,
      modelFound,
      models,
      resolvedModel,
      modelMatch: resolution.matchType,
      status: response.status,
      detail: modelFound === true
        ? (
            aliasResolved
              ? "旧設定Model「" + expected + "」を「" + resolvedModel + "」へ自動解決しました。"
              : "Endpoint / Model確認OK: " + resolvedModel
          )
        : "Endpointへ接続できました。"
    };
  } catch (error) {
    return {
      ok: false,
      endpointOk: false,
      modelFound: null,
      models: [],
      detail: "Endpointへ接続できません: " + String(error?.message || error).slice(0, 220)
    };
  } finally {
    clearTimeout(timeout);
  }
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

function parseUiTarsResultPayload(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const status = String(value.status || "").toUpperCase();
    if (AI_TEST_STATUSES.includes(status)) {
      return value;
    }
  }

  const source = String(value ?? "").trim();
  if (!source) return null;

  const directCandidates = [source];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) directCandidates.push(fenced[1].trim());

  const objectMatch = source.match(/\{\s*["']?status["']?\s*:\s*["']?(PASS|FAIL|WARNING|UNKNOWN)["']?[\s\S]*?\}/i);
  if (objectMatch?.[0]) directCandidates.push(objectMatch[0]);

  for (const candidateSource of directCandidates) {
    const candidate = candidateSource
      .replace(/^\s*finished\s*\(\s*content\s*=\s*/i, "")
      .replace(/\)\s*$/i, "")
      .trim();

    const unquoted =
      (candidate.startsWith("'") && candidate.endsWith("'")) ||
      (candidate.startsWith('"') && candidate.endsWith('"'))
        ? candidate.slice(1, -1)
        : candidate;

    for (const possible of [unquoted, unquoted.replace(/\\(["'\\])/g, "$1")]) {
      try {
        const parsed = JSON.parse(
          possible
            .replace(/([{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
        );
        const status = String(parsed?.status || "").toUpperCase();
        if (AI_TEST_STATUSES.includes(status)) return parsed;
      } catch {}
    }
  }

  return null;
}

const CONTRADICTORY_PASS_PATTERNS = [
  /変化(?:は|が|を)?(?:見られ|確認でき)(?:ない|ません|なかった)/i,
  /変化なし/i,
  /反応(?:が|は)?(?:ない|ありません|なかった)/i,
  /確認でき(?:ない|ません|なかった)/i,
  /見られ(?:ない|ません|なかった)/i,
  /no\s+(?:visible\s+)?change/i,
  /no\s+response/i,
  /could\s+not\s+confirm/i,
  /unable\s+to\s+confirm/i,
  /did\s+not\s+(?:move|change|respond)/i,
  /没有变化/i,
  /未观察到/i,
  /无法确认/i
];

export function normalizeUiTarsEvidenceResult(result = {}) {
  const normalized = {
    status: AI_TEST_STATUSES.includes(String(result?.status).toUpperCase())
      ? String(result.status).toUpperCase()
      : "UNKNOWN",
    actual: text(result?.actual || result?.result || "", 1500),
    reason: text(result?.reason || result?.explanation || "", 1500),
    confidence: normalizeConfidence(result?.confidence)
  };

  const evidenceText = [normalized.actual, normalized.reason]
    .filter(Boolean)
    .join("\n");

  if (
    normalized.status === "PASS" &&
    CONTRADICTORY_PASS_PATTERNS.some((pattern) => pattern.test(evidenceText))
  ) {
    return {
      ...normalized,
      status: "UNKNOWN",
      confidence: "low",
      reason:
        "AIはPASSを返しましたが、説明内容には成功条件を確認できなかった記述が含まれるためUNKNOWNに補正しました。" +
        (normalized.reason ? " 元の説明: " + normalized.reason : "")
    };
  }

  return normalized;
}

function normalizedUiTarsResult(payload) {
  return normalizeUiTarsEvidenceResult(payload);
}

export function parseUiTarsFinished(value) {
  const payload = parseUiTarsResultPayload(value);
  if (payload) return normalizedUiTarsResult(payload);

  return {
    status: "UNKNOWN",
    actual: "",
    reason: "AIから機械可読な最終判定を取得できませんでした。",
    confidence: "low"
  };
}

export function extractUiTarsFinishedResult(data) {
  const conversations = Array.isArray(data?.conversations) ? data.conversations : [];

  for (let conversationIndex = conversations.length - 1; conversationIndex >= 0; conversationIndex -= 1) {
    const conversation = conversations[conversationIndex];
    const predictions = Array.isArray(conversation?.predictionParsed)
      ? conversation.predictionParsed
      : [];

    for (let predictionIndex = predictions.length - 1; predictionIndex >= 0; predictionIndex -= 1) {
      const prediction = predictions[predictionIndex];
      if (String(prediction?.action_type || "").toLowerCase() !== "finished") continue;

      const content = prediction?.action_inputs?.content ??
        prediction?.action_inputs?.result ??
        prediction?.action_inputs?.text ??
        "";

      const payload = parseUiTarsResultPayload(content);
      if (payload) return normalizedUiTarsResult(payload);

      return {
        status: "UNKNOWN",
        actual: text(content, 1500),
        reason: "AIはfinishedで終了しましたが、最終判定JSONを解析できませんでした。",
        confidence: "low"
      };
    }
  }

  return null;
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
  const confirmedWindowTitle = text(
    context.confirmedWindowTitle || context.windowTitle || "",
    180
  );
  const runtimeConfirmation = context.targetWindowConfirmed
    ? "Hub runtime確認: 対象ゲームウィンドウ「" + (confirmedWindowTitle || "設定済みゲーム") +
      "」は、このテスト開始前に実際に検出・フォーカス済みです。ゲームは起動済みとして扱ってください。"
    : "";

  const focusedGuidance = test.id === "wasd_move"
    ? "WASD移動テストでは、まずWキーを短く1回押し、次の画面で変化を1回確認したらすぐ終了してください。画面が読み取りづらくてもゲーム未起動とは推測せず、対象ゲームへ直接キー入力を試してください。探索や長距離移動は不要です。"
    : (test.id === "mouse_click"
        ? "マウス視点テストでは、対象ゲームはフォーカス済みなので、マウスを画面中央付近から右方向へ小さく1回だけ動かしてください。クリック対象を探したり複数回クリックしたりせず、次の画面で背景・照準・カメラの見え方が変わったかを1回確認してすぐ終了してください。"
        : "");

  const fixedTestLimit = test.id === "ai_exploration"
    ? ""
    : "固定テストでは最小限の操作だけを行い、遅くとも3回以内の画面確認で必ず終了してください。固定テストでは call_user() を使わず、操作不能なら finished(...UNKNOWN...) で理由を返してください。";

  return [
    "あなたはGame Dev HubのWindowsゲーム専用テスト担当です。",
    "操作対象は指定されたテスト対象ゲームのウィンドウだけです。",
    "ファイル操作、PowerShell/Terminal、GitHub操作、外部送信、購入、パスワード入力、管理者権限、Windows設定変更は禁止です。",
    "別アプリへ移動しないでください。判断できない場合は推測せずUNKNOWNにしてください。",
    runtimeConfirmation,
    fixedTestLimit,
    focusedGuidance,
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

export async function launchTestExecutable(config, extraArgs = []) {
  const executable = await inspectExecutable(config.exePath);
  if (!executable.ok) {
    const error = new Error(executable.message);
    error.code = executable.code;
    throw error;
  }

  const child = spawn(
    config.exePath,
    [
      ...(Array.isArray(config.launchArgs) ? config.launchArgs : []),
      ...(Array.isArray(extraArgs) ? extraArgs : [])
    ],
    {
      cwd: path.dirname(config.exePath),
      windowsHide: false,
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    }
  );

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

function numericTriple(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const numbers = value.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

function wrappedAngleDistance(a, b) {
  const first = Number(a);
  const second = Number(b);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  let delta = second - first;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

export async function waitForRuntimeTestBridgeState(
  filePath,
  sessionId,
  { afterSequence = 0, timeoutMs = 15000, signal } = {}
) {
  const expectedSession = text(sessionId, 180);
  const deadline = Date.now() + Math.max(500, Number(timeoutMs) || 15000);

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("AI_TEST_ABORTED");

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const payload = JSON.parse(raw);
      const sequence = Number(payload?.sequence || 0);
      if (
        [1, 2].includes(Number(payload?.schemaVersion || 0)) &&
        String(payload?.sessionId || "") === expectedSession &&
        sequence > Number(afterSequence || 0) &&
        payload?.state &&
        typeof payload.state === "object" &&
        !Array.isArray(payload.state)
      ) {
        return payload;
      }
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("RUNTIME_TEST_BRIDGE_TIMEOUT");
}

export function evaluateRuntimeBridgeTest(testId, beforeEnvelope, afterEnvelope) {
  const before = beforeEnvelope?.state || {};
  const after = afterEnvelope?.state || {};

  if (testId === "game_launch") {
    if (after?.ready === true) {
      return {
        status: "PASS",
        confidence: "high",
        actual: "Runtime Test Bridgeがready=trueを返しました。",
        reason: "Game WindowとRuntime telemetry sessionの両方を確認できました。"
      };
    }
    return {
      status: "UNKNOWN",
      confidence: "low",
      actual: "",
      reason: "Runtime Test Bridgeのready状態を確認できませんでした。"
    };
  }

  if (testId === "wasd_move") {
    const from = numericTriple(before?.player?.position);
    const to = numericTriple(after?.player?.position);
    if (!from || !to) {
      return {
        status: "UNKNOWN",
        confidence: "low",
        actual: "",
        reason: "Player position telemetryを取得できませんでした。"
      };
    }

    const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    return distance >= 0.05
      ? {
          status: "PASS",
          confidence: "high",
          actual: "W入力後にPlayer positionが" + distance.toFixed(3) + "m変化しました。",
          reason: "Screenshot推測ではなくRuntime座標のBefore / After差分で移動を確認しました。"
        }
      : {
          status: "FAIL",
          confidence: "high",
          actual: "W入力後のPlayer position変化は" + distance.toFixed(3) + "mでした。",
          reason: "Runtime座標が移動判定閾値0.05mを超えませんでした。"
        };
  }

  if (testId === "mouse_click") {
    const yaw = wrappedAngleDistance(before?.player?.yaw, after?.player?.yaw);
    const pitch = wrappedAngleDistance(before?.player?.pitch, after?.player?.pitch);
    if (yaw === null || pitch === null) {
      return {
        status: "UNKNOWN",
        confidence: "low",
        actual: "",
        reason: "Camera yaw / pitch telemetryを取得できませんでした。"
      };
    }

    const delta = Math.max(yaw, pitch);
    return delta >= 0.003
      ? {
          status: "PASS",
          confidence: "high",
          actual:
            "マウス入力後にCamera角度が変化しました（yaw " +
            yaw.toFixed(4) + " rad / pitch " + pitch.toFixed(4) + " rad）。",
          reason: "Runtime Test BridgeのCamera角度差分でマウスルックを確認しました。"
        }
      : {
          status: "FAIL",
          confidence: "high",
          actual:
            "マウス入力後のCamera角度変化は小さいままでした（yaw " +
            yaw.toFixed(4) + " rad / pitch " + pitch.toFixed(4) + " rad）。",
          reason: "Camera角度が判定閾値0.003 radを超えませんでした。"
        };
  }

  return {
    status: "UNKNOWN",
    confidence: "low",
    actual: "",
    reason: "この固定テストにはRuntime Test Bridgeの判定方法がまだ定義されていません。"
  };
}

export async function executeDeterministicGameInput({
  testId,
  allowedWindowTitles,
  signal,
  onProgress = () => {}
}) {
  if (signal?.aborted) throw new Error("AI_TEST_ABORTED");

  const active = await activeWindowContext();
  if (!targetWindowAllowed(active.title, allowedWindowTitles || [])) {
    throw new Error("AI_TEST_WINDOW_SCOPE_VIOLATION");
  }

  const nut = await import("@computer-use/nut-js");

  if (testId === "wasd_move") {
    onProgress({
      phase: "action",
      message: "Wキーを短時間入力しています",
      action: "W key 350ms"
    });
    await nut.keyboard.pressKey(nut.Key.W);
    try {
      await nut.sleep(350);
    } finally {
      await nut.keyboard.releaseKey(nut.Key.W);
    }
    await nut.sleep(300);
    return [{ action: "W key 350ms", windowTitle: active.title }];
  }

  if (testId === "mouse_click") {
    const current = await nut.mouse.getPosition();
    nut.mouse.config.mouseSpeed = 1800;
    onProgress({
      phase: "action",
      message: "マウスを右へ小さく動かしています",
      action: "mouse move +80px"
    });
    await nut.mouse.move(nut.straightTo(new nut.Point(current.x + 80, current.y)));
    await nut.sleep(350);
    return [{ action: "mouse move +80px", windowTitle: active.title }];
  }

  return [];
}

export function createUiTarsRuntimeFetch(signal, fetchImpl = globalThis.fetch) {
  if (!signal || typeof signal.addEventListener !== "function") {
    throw new Error("UI-TARS runtime AbortSignalが必要です。");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("HTTP接続機能を利用できません。");
  }

  return async (input, init = {}) => {
    if (signal.aborted) {
      throw new Error("AI_TEST_ABORTED");
    }

    // @ui-tars/sdk@1.2.3 hard-codes a 30s model-request timeout and passes
    // that timeout through RequestInit.signal. Replace only that internal
    // signal with the Hub-owned signal so the configured test timeout and
    // emergency stop remain the authoritative cancellation boundary.
    return fetchImpl(input, {
      ...init,
      signal
    });
  };
}

export async function runUiTarsTest({
  config,
  test,
  apiKey,
  allowedWindowTitles,
  confirmedWindowTitle = "",
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

  let lastData = null;
  let finalResult = null;
  let agentStatus = "";
  let agentTurns = 0;
  let lastAgentMessage = "";
  let agentError = "";
  const maxLoopCount = test.id === "ai_exploration" ? 20 : 3;

  const agent = new GUIAgent({
    model: {
      baseURL: config.uiTars.baseUrl,
      apiKey: apiKey || "local",
      model: config.uiTars.model,
      fetch: createUiTarsRuntimeFetch(effectiveSignal)
    },
    operator: safeOperator,
    signal: effectiveSignal,
    maxLoopCount,
    onData: ({ data }) => {
      lastData = data || lastData;
      agentStatus = text(data?.status || agentStatus, 80);

      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
      for (const conversation of conversations) {
        if (conversation?.from === "gpt") {
          agentTurns += 1;
          if (conversation?.value) {
            lastAgentMessage = text(conversation.value, 2000);
          }
        }
      }

      const structuredResult = extractUiTarsFinishedResult(data);
      if (structuredResult) finalResult = structuredResult;

      onProgress({
        phase: "thinking",
        message: finalResult ? "AIが最終判定を返しました" : "AIが画面を確認しています"
      });
    },
    onError: ({ error }) => {
      agentError = text(error?.message || error, 1000);
      onProgress({
        phase: "warning",
        message: "UI-TARS: " + text(error?.message || error, 240)
      });
    }
  });

  const prompt = buildUiTarsTestPrompt(test, {
    windowTitle: config.windowTitle,
    confirmedWindowTitle,
    targetWindowConfirmed: Boolean(confirmedWindowTitle)
  });
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

    await Promise.race([runPromise, timeoutPromise]);

    if (!finalResult && agentStatus === "error" && agentError) {
      return {
        status: "UNKNOWN",
        actual: "",
        reason: "UI-TARSのモデル応答を取得できませんでした: " + agentError,
        confidence: "low",
        actions,
        agent: {
          status: agentStatus,
          turns: agentTurns,
          lastMessage: lastAgentMessage,
          error: agentError,
          maxLoopCount,
          timeoutSeconds: Math.round(timeoutMs / 1000)
        }
      };
    }

    if (!finalResult && agentStatus === "call_user" && test.id !== "ai_exploration") {
      return {
        status: "UNKNOWN",
        actual: "",
        reason: "固定テスト中にAIが call_user() で終了しました。対象ゲームはHubが検出済みのため、ゲーム画面上の操作を直接行う必要があります。",
        confidence: "low",
        actions,
        agent: {
          status: agentStatus,
          turns: agentTurns,
          lastMessage: lastAgentMessage,
          error: agentError,
          maxLoopCount,
          timeoutSeconds: Math.round(timeoutMs / 1000)
        }
      };
    }

    const parsed = finalResult ||
      extractUiTarsFinishedResult(lastData) ||
      parseUiTarsFinished(lastAgentMessage);

    return {
      ...parsed,
      actions,
      agent: {
        status: agentStatus,
        turns: agentTurns,
        lastMessage: lastAgentMessage,
        error: agentError,
        maxLoopCount,
        timeoutSeconds: Math.round(timeoutMs / 1000)
      }
    };
  } catch (error) {
    if (String(error?.message || error).includes("AI_TEST_TIMEOUT")) {
      return {
        status: "UNKNOWN",
        actual: actions.length
          ? "制限時間内にAI操作を" + actions.length + "回実行しましたが、最終判定まで完了しませんでした。"
          : "制限時間内にAI操作を完了できませんでした。",
        reason: "テストの制限時間を超えました。最後のAI状態: " + (agentStatus || "不明"),
        confidence: "low",
        actions,
        agent: {
          status: agentStatus || "timeout",
          turns: agentTurns,
          lastMessage: lastAgentMessage,
          error: agentError,
          maxLoopCount,
          timeoutSeconds: Math.round(timeoutMs / 1000)
        }
      };
    }
    throw error;
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

export async function latestRuntimeBridgeReport(dataRoot, projectId) {
  const history = await listAiTestHistory(dataRoot, projectId, MAX_HISTORY);
  const match = history.find((item) => item.engine === "Runtime Test Bridge");
  if (!match) return null;
  return loadAiTestReport(dataRoot, projectId, match.testRunId);
}
