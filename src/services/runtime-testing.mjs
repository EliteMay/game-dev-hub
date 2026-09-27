import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const BRIDGE_SCHEMA_VERSION = 1;
const POLL_INTERVAL_MS = 80;

function text(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
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

function aborted(signal) {
  if (signal?.aborted) {
    const error = new Error("RUNTIME_TEST_ABORTED");
    error.code = "RUNTIME_TEST_ABORTED";
    throw error;
  }
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("RUNTIME_TEST_ABORTED"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new Error("RUNTIME_TEST_ABORTED"));
    }, { once: true });
  });
}

export function makeRuntimeTestSessionId() {
  return randomUUID();
}

export function runtimeTestStatePath(dataRoot, projectId, runId) {
  return path.join(
    dataRoot,
    "runtime-testing",
    "runs",
    safeProjectId(projectId),
    safeRunId(runId),
    "state.json"
  );
}

export function buildRuntimeBridgeLaunchArgs(existingArgs = [], statePath, sessionId) {
  const args = Array.isArray(existingArgs)
    ? existingArgs.map((item) => String(item))
    : [];
  if (!args.includes("--")) args.push("--");
  args.push(
    "--foundation-test-state=" + String(statePath),
    "--foundation-test-session=" + String(sessionId)
  );
  return args;
}

export function parseRuntimeSnapshot(value, expectedSessionId = "") {
  const payload = typeof value === "string" ? JSON.parse(value) : value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("RUNTIME_TEST_BRIDGE_INVALID");
  }
  if (Number(payload.schemaVersion) !== BRIDGE_SCHEMA_VERSION) {
    throw new Error("RUNTIME_TEST_BRIDGE_SCHEMA_MISMATCH");
  }
  if (expectedSessionId && String(payload.sessionId || "") !== String(expectedSessionId)) {
    throw new Error("RUNTIME_TEST_BRIDGE_SESSION_MISMATCH");
  }
  if (!Number.isFinite(Number(payload.sequence)) || Number(payload.sequence) < 1) {
    throw new Error("RUNTIME_TEST_BRIDGE_SEQUENCE_INVALID");
  }
  if (!payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) {
    throw new Error("RUNTIME_TEST_BRIDGE_STATE_INVALID");
  }
  return {
    ...payload,
    sequence: Number(payload.sequence),
    state: payload.state
  };
}

export async function readRuntimeSnapshot(filePath, expectedSessionId = "") {
  const source = await fs.readFile(filePath, "utf8");
  return parseRuntimeSnapshot(source, expectedSessionId);
}

export async function waitForRuntimeSnapshot(
  filePath,
  expectedSessionId,
  {
    minSequence = 0,
    timeoutMs = 15000,
    signal
  } = {}
) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    aborted(signal);
    try {
      const snapshot = await readRuntimeSnapshot(filePath, expectedSessionId);
      if (snapshot.sequence > Number(minSequence || 0) && snapshot.state?.ready !== false) {
        return snapshot;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(POLL_INTERVAL_MS, signal);
  }
  const error = new Error(
    "RUNTIME_TEST_BRIDGE_TIMEOUT" +
      (lastError?.message ? ": " + lastError.message : "")
  );
  error.code = "RUNTIME_TEST_BRIDGE_TIMEOUT";
  throw error;
}

function vector3(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const result = value.map(Number);
  return result.every(Number.isFinite) ? result : null;
}

export function planarDistance(before, after) {
  const a = vector3(before);
  const b = vector3(after);
  if (!a || !b) return null;
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

export function shortestAngleDelta(before, after) {
  const a = Number(before);
  const b = Number(after);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

export function evaluateMovement(beforeState, afterState, minimumDistance = 0.05) {
  const distance = planarDistance(
    beforeState?.player?.position,
    afterState?.player?.position
  );
  if (distance === null) {
    return {
      status: "UNKNOWN",
      confidence: "low",
      actual: "",
      reason: "Player座標Telemetryを取得できませんでした。"
    };
  }
  if (distance >= minimumDistance) {
    return {
      status: "PASS",
      confidence: "high",
      actual: "Player座標が約" + distance.toFixed(3) + "m変化しました。",
      reason: "Game内部のPlayer positionをBefore / Afterで比較しました。",
      metric: distance
    };
  }
  return {
    status: "FAIL",
    confidence: "high",
    actual: "Player座標の変化は約" + distance.toFixed(3) + "mでした。",
    reason: "Wキー入力後もGame内部Player positionが必要量変化しませんでした。",
    metric: distance
  };
}

export function evaluateMouseLook(beforeState, afterState, minimumRadians = 0.005) {
  const yaw = shortestAngleDelta(beforeState?.player?.yaw, afterState?.player?.yaw);
  const pitch = shortestAngleDelta(beforeState?.player?.pitch, afterState?.player?.pitch);
  if (yaw === null || pitch === null) {
    return {
      status: "UNKNOWN",
      confidence: "low",
      actual: "",
      reason: "Camera角度Telemetryを取得できませんでした。"
    };
  }
  const delta = Math.max(yaw, pitch);
  if (delta >= minimumRadians) {
    return {
      status: "PASS",
      confidence: "high",
      actual:
        "Camera角度が変化しました（yaw " + yaw.toFixed(4) +
        " rad / pitch " + pitch.toFixed(4) + " rad）。",
      reason: "Game内部のcamera yaw / pitchをBefore / Afterで比較しました。",
      metric: delta
    };
  }
  return {
    status: "FAIL",
    confidence: "high",
    actual:
      "Camera角度変化はyaw " + yaw.toFixed(4) +
      " rad / pitch " + pitch.toFixed(4) + " radでした。",
    reason: "マウス入力後もGame内部Camera角度が必要量変化しませんでした。",
    metric: delta
  };
}

async function activeWindowTitle(nut) {
  const current = await nut.getActiveWindow();
  let title = "";
  try {
    title = await current.title;
  } catch {
    if (typeof current?.getTitle === "function") {
      title = await current.getTitle();
    }
  }
  return String(title || "");
}

async function assertTargetWindow(nut, expectedWindowTitle) {
  const actual = await activeWindowTitle(nut);
  const expected = text(expectedWindowTitle, 180).toLowerCase();
  if (!expected || !actual.toLowerCase().includes(expected)) {
    const error = new Error("RUNTIME_TEST_WINDOW_SCOPE_VIOLATION");
    error.actualWindowTitle = actual;
    throw error;
  }
  return actual;
}

export async function performRuntimeInput(kind, expectedWindowTitle, signal) {
  aborted(signal);
  const nut = await import("@computer-use/nut-js");
  const windowTitle = await assertTargetWindow(nut, expectedWindowTitle);

  if (kind === "wasd_move") {
    await nut.keyboard.pressKey(nut.Key.W);
    try {
      await delay(420, signal);
    } finally {
      await nut.keyboard.releaseKey(nut.Key.W).catch(() => {});
    }
    await delay(220, signal);
    await assertTargetWindow(nut, expectedWindowTitle);
    return {
      action: "press W for 420ms",
      windowTitle
    };
  }

  if (kind === "mouse_look") {
    const width = Number(await nut.screen.width());
    const height = Number(await nut.screen.height());
    const centerX = Math.max(1, Math.round(width / 2));
    const centerY = Math.max(1, Math.round(height / 2));
    const targetX = Math.min(Math.max(1, width - 2), centerX + 160);
    nut.mouse.config.mouseSpeed = 2400;
    await nut.mouse.move(nut.straightTo(new nut.Point(centerX, centerY)));
    await delay(80, signal);
    await nut.mouse.move(nut.straightTo(new nut.Point(targetX, centerY)));
    await delay(260, signal);
    await assertTargetWindow(nut, expectedWindowTitle);
    return {
      action: "move mouse right by " + Math.max(0, targetX - centerX) + "px",
      windowTitle
    };
  }

  throw new Error("RUNTIME_TEST_UNSUPPORTED_INPUT");
}
