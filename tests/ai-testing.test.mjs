import test from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";

import {
  buildOpenAiModelsUrl,
  buildReproductionSteps,
  buildUiTarsTestPrompt,
  computerActionSource,
  createUiTarsRuntimeFetch,
  DEFAULT_UI_TARS_MODEL,
  evaluateRuntimeBridgeTest,
  extractUiTarsFinishedResult,
  maskScreenshotToWindow,
  normalizeMaskRegion,
  normalizeUiTarsEvidenceResult,
  parseUiTarsFinished,
  probeOpenAiModelEndpoint,
  resolveUiTarsModelId,
  sanitizeAiTestConfig,
  summarizeAiTestResults,
  validateComputerAction,
  waitForRuntimeTestBridgeState
} from "../src/services/ai-testing.mjs";

test("AI test config keeps executable automation narrow and project-specific", () => {
  const config = sanitizeAiTestConfig({
    exePath: "C:/Games/example/example.exe",
    windowTitle: "Example Game",
    engine: "ui-tars",
    timeout: 90,
    launchArgs: ["--test"],
    tests: [{
      id: "mining_pickup",
      name: "採掘して拾う",
      description: "鉱石を壊して拾う",
      expected: "石が1増える",
      timeout: 60
    }]
  });

  assert.equal(config.engine, "ui-tars");
  assert.equal(config.windowTitle, "Example Game");
  assert.equal(config.tests[0].id, "mining_pickup");
  assert.equal(config.tests[0].enabled, true);
  assert.equal(config.launchArgs[0], "--test");
});

test("unsafe computer actions are blocked before reaching UI-TARS operator", () => {
  assert.equal(validateComputerAction("press(key='w')").ok, true);
  assert.equal(validateComputerAction("click(x=100,y=200)").ok, true);
  assert.equal(validateComputerAction("hotkey(keys=['ctrl','shift','esc'])").ok, false);
  assert.equal(validateComputerAction("typewrite(text='password')").ok, false);
  assert.equal(validateComputerAction("powershell('Remove-Item x')").ok, false);
});

test("UI-TARS machine-readable result falls back to UNKNOWN when evidence is missing", () => {
  const parsed = parseUiTarsFinished("finished(content='not machine readable')");
  assert.equal(parsed.status, "UNKNOWN");

  const pass = parseUiTarsFinished(
    'finished(content=\'{"status":"PASS","actual":"移動した","confidence":"high","reason":"画面変化を確認"}\')'
  );
  assert.equal(pass.status, "PASS");
  assert.equal(pass.confidence, "high");
});

test("contradictory PASS evidence is downgraded to UNKNOWN", () => {
  const result = normalizeUiTarsEvidenceResult({
    status: "PASS",
    actual: "プレイヤーやカメラの位置が変化するなどの確認を行ったが、変化は見られない。",
    confidence: "low",
    reason: "変化は見られない。"
  });

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.confidence, "low");
  assert.match(result.reason, /UNKNOWNに補正/);

  const positive = normalizeUiTarsEvidenceResult({
    status: "PASS",
    actual: "背景の位置が右へ動いた",
    confidence: "medium",
    reason: "視点変化を確認した"
  });
  assert.equal(positive.status, "PASS");
});

test("result summary preserves PASS FAIL WARNING UNKNOWN separately", () => {
  assert.deepEqual(
    summarizeAiTestResults([
      { status: "PASS" },
      { status: "PASS" },
      { status: "FAIL" },
      { status: "WARNING" },
      { status: "UNKNOWN" }
    ]),
    { total: 5, passed: 2, failed: 1, warning: 1, unknown: 1 }
  );
});

test("UI-TARS prompt explicitly constrains desktop scope and unknown decisions", () => {
  const prompt = buildUiTarsTestPrompt({
    name: "移動",
    description: "Wを押す",
    expected: "画面が移動する"
  }, { windowTitle: "Test Game" });

  assert.match(prompt, /対象ゲームのウィンドウだけ/);
  assert.match(prompt, /推測せずUNKNOWN/);
  assert.match(prompt, /PowerShell\/Terminal/);
  assert.match(prompt, /finished\(content=/);
});

test("failed action log can be turned into deterministic reproduction steps", () => {
  const steps = buildReproductionSteps([
    { action: "press(key='w')" },
    { action: "click(x=20,y=30)" }
  ]);
  assert.deepEqual(steps, [
    "1. press(key='w')",
    "2. click(x=20,y=30)"
  ]);
});

test("UI-TARS execute params ignore model thought text during safety validation", () => {
  const params = {
    prediction: "hotkey(key='w')",
    parsedPrediction: {
      action_type: "hotkey",
      action_inputs: { key: "w" },
      thought: "I might mention password or GitHub here, but this is not the executable action.",
      reflection: null
    },
    screenWidth: 1280,
    screenHeight: 720
  };

  assert.equal(validateComputerAction(params).ok, true);
  assert.equal(
    computerActionSource(params),
    JSON.stringify({ action_type: "hotkey", action_inputs: { key: "w" } })
  );
});


test("official UI-TARS NutJS action names stay compatible with the safety allowlist", () => {
  const action = (action_type, action_inputs = {}) => ({
    parsedPrediction: { action_type, action_inputs }
  });

  for (const type of [
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
    "finished",
    "call_user",
    "user_stop",
    "error_env"
  ]) {
    const inputs = type === "scroll" ? { direction: "down" } : {};
    assert.equal(validateComputerAction(action(type, inputs)).ok, true, type);
  }

  assert.equal(validateComputerAction(action("press", { key: "w" })).ok, true);
  assert.equal(validateComputerAction(action("release", { key: "w" })).ok, true);
  assert.equal(validateComputerAction(action("hotkey", { key: "ctrl+s" })).ok, true);
  assert.equal(validateComputerAction(action("hotkey", { key: "ctrl+shift+esc" })).ok, false);
  assert.equal(validateComputerAction(action("type", { content: "secret" })).ok, false);
  assert.equal(validateComputerAction(action("middle_click")).ok, false);
});

test("mask region is clamped to screenshot dimensions", () => {
  assert.deepEqual(
    normalizeMaskRegion({ left: -20, top: 5, width: 100, height: 80 }, 60, 40),
    { left: 0, top: 5, right: 60, bottom: 40 }
  );
  assert.throws(
    () => normalizeMaskRegion({ left: 10, top: 10, width: 0, height: 0 }, 100, 100),
    /AI_TEST_SCREEN_MASK_FAILED/
  );
});

test("AI screenshot blacks out every pixel outside the active game window", async () => {
  const image = new Jimp({ width: 4, height: 4, color: 0xffffffff });
  const png = await image.getBuffer("image/png");

  const masked = await maskScreenshotToWindow(
    { base64: png.toString("base64"), scaleFactor: 1 },
    { left: 1, top: 1, width: 2, height: 2 }
  );

  const result = await Jimp.read(Buffer.from(masked.base64, "base64"));
  assert.equal(result.getPixelColor(0, 0), 0x000000ff);
  assert.equal(result.getPixelColor(3, 3), 0x000000ff);
  assert.equal(result.getPixelColor(1, 1), 0xffffffff);
  assert.equal(result.getPixelColor(2, 2), 0xffffffff);
});


test("non-executable final report text does not trigger action safety false positives", () => {
  const result = validateComputerAction({
    parsedPrediction: {
      action_type: "finished",
      action_inputs: {
        content: "GitHubやpasswordという単語を結果説明に含むだけで、操作は実行しない"
      }
    }
  });
  assert.equal(result.ok, true);
});


test("AI test config falls back to Godot project launch defaults before Windows export exists", () => {
  const config = sanitizeAiTestConfig(
    {
      exePath: "",
      launchArgs: [],
      windowTitle: "Deep Factory"
    },
    {
      exePath: "C:/Tools/Godot/Godot_v4.7.2-stable_win64.exe",
      launchArgs: ["--path", "C:/Games/deep-factory"],
      windowTitle: "Deep Factory",
      targetVersion: "dev"
    }
  );

  assert.equal(config.exePath, "C:/Tools/Godot/Godot_v4.7.2-stable_win64.exe");
  assert.deepEqual(config.launchArgs, ["--path", "C:/Games/deep-factory"]);
  assert.equal(config.targetVersion, "dev");
});

test("explicit Windows executable keeps its own launch arguments instead of Godot defaults", () => {
  const config = sanitizeAiTestConfig(
    {
      exePath: "C:/Games/deep-factory/deep-factory.exe",
      launchArgs: ["--test"]
    },
    {
      exePath: "C:/Tools/Godot/Godot.exe",
      launchArgs: ["--path", "C:/Games/deep-factory"]
    }
  );

  assert.equal(config.exePath, "C:/Games/deep-factory/deep-factory.exe");
  assert.deepEqual(config.launchArgs, ["--test"]);
});

test("OpenAI-compatible model diagnostics check /models and configured model identity", async () => {
  assert.equal(
    buildOpenAiModelsUrl("http://127.0.0.1:1234/v1"),
    "http://127.0.0.1:1234/v1/models"
  );

  const ok = await probeOpenAiModelEndpoint({
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "ui-tars-1.5",
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://127.0.0.1:1234/v1/models");
      assert.equal(options.method, "GET");
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [{ id: "ui-tars-1.5" }, { id: "other-model" }] };
        }
      };
    }
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.modelFound, true);

  const mismatch = await probeOpenAiModelEndpoint({
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "ui-tars-1.5",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { data: [{ id: "bonsai-2-27b" }] };
      }
    })
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.endpointOk, true);
  assert.equal(mismatch.modelFound, false);
  assert.match(mismatch.detail, /bonsai-2-27b/);
});

test("HTTP errors are not accepted as a healthy UI-TARS endpoint", async () => {
  const result = await probeOpenAiModelEndpoint({
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "ui-tars-1.5",
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      async json() {
        return {};
      }
    })
  });

  assert.equal(result.ok, false);
  assert.equal(result.endpointOk, false);
  assert.match(result.detail, /HTTP 404/);
});


test("UI-TARS undeclared runtime import is pinned as a production dependency", async () => {
  const pkg = JSON.parse(
    await (await import("node:fs/promises")).readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(pkg.dependencies?.uuid, "9.0.1");
  const uuid = await import("uuid");
  assert.equal(typeof uuid.v4, "function");

  const sdk = await import("@ui-tars/sdk");
  assert.equal(typeof sdk.GUIAgent, "function");
});


test("new AI test configs use the actual UI-TARS 1.5 7B model id", () => {
  const config = sanitizeAiTestConfig({});
  assert.equal(DEFAULT_UI_TARS_MODEL, "ui-tars-1.5-7b");
  assert.equal(config.uiTars.model, "ui-tars-1.5-7b");
});

test("legacy ui-tars-1.5 setting resolves to the single loaded 7B model", async () => {
  const resolution = resolveUiTarsModelId("ui-tars-1.5", [
    "ui-tars-1.5-7b",
    "qwen/qwen3-4b"
  ]);
  assert.deepEqual(resolution, {
    matched: true,
    resolvedModel: "ui-tars-1.5-7b",
    matchType: "legacy-alias"
  });

  const result = await probeOpenAiModelEndpoint({
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "ui-tars-1.5",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          data: [
            { id: "ui-tars-1.5-7b" },
            { id: "openai/gpt-oss-20b" }
          ]
        };
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.modelFound, true);
  assert.equal(result.resolvedModel, "ui-tars-1.5-7b");
  assert.equal(result.modelMatch, "legacy-alias");
  assert.match(result.detail, /自動解決/);
});

test("legacy UI-TARS alias is not guessed when multiple matching model ids are loaded", () => {
  const resolution = resolveUiTarsModelId("ui-tars-1.5", [
    "ui-tars-1.5-7b",
    "ui-tars-1.5-2b"
  ]);
  assert.equal(resolution.matched, false);
  assert.equal(resolution.matchType, "none");
});


test("UI-TARS finished result is read from official onData predictionParsed shape", () => {
  const result = extractUiTarsFinishedResult({
    status: "end",
    conversations: [{
      from: "gpt",
      value: "Thought: done. Action: finished(...)",
      predictionParsed: [{
        action_type: "finished",
        action_inputs: {
          content: "{\"status\":\"PASS\",\"actual\":\"プレイヤーが右へ移動した\",\"confidence\":\"high\",\"reason\":\"画面位置の変化を確認\"}"
        }
      }]
    }]
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.confidence, "high");
  assert.match(result.actual, /右へ移動/);
});

test("UI-TARS finished action without JSON stays UNKNOWN but preserves its content", () => {
  const result = extractUiTarsFinishedResult({
    conversations: [{
      from: "gpt",
      predictionParsed: [{
        action_type: "finished",
        action_inputs: { content: "画面変化は見えました" }
      }]
    }]
  });

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.actual, "画面変化は見えました");
  assert.match(result.reason, /finished/);
});

test("v1 default basic AI tests migrate from 45s to 120s for local model latency", () => {
  const config = sanitizeAiTestConfig({
    version: 1,
    tests: [
      {
        id: "wasd_move",
        name: "WASD移動",
        description: "移動",
        expected: "変化",
        timeout: 45,
        enabled: true
      },
      {
        id: "mouse_click",
        name: "マウス操作",
        description: "クリック",
        expected: "変化",
        timeout: 45,
        enabled: true
      }
    ]
  });

  assert.equal(config.version, 3);
  assert.equal(config.tests[0].timeout, 120);
  assert.equal(config.tests[1].timeout, 120);
});

test("legacy default mouse click smoke test migrates to a mouse-look check without overwriting custom tests", () => {
  const migrated = sanitizeAiTestConfig({
    version: 2,
    tests: [{
      id: "mouse_click",
      name: "マウス操作",
      description: "ゲーム画面内の安全な操作対象を1つクリックする",
      expected: "クリックに応じたUIまたはゲーム状態の変化が確認できる",
      timeout: 120,
      enabled: true
    }]
  });

  assert.equal(migrated.version, 3);
  assert.equal(migrated.tests[0].name, "マウス視点");
  assert.match(migrated.tests[0].description, /視点変化/);
  assert.match(migrated.tests[0].expected, /マウスルック/);

  const custom = sanitizeAiTestConfig({
    version: 2,
    tests: [{
      id: "mouse_click",
      name: "UIクリック確認",
      description: "メニューをクリックする",
      expected: "メニューが開く",
      timeout: 120,
      enabled: true
    }]
  });

  assert.equal(custom.tests[0].name, "UIクリック確認");
  assert.equal(custom.tests[0].description, "メニューをクリックする");
  assert.equal(custom.tests[0].expected, "メニューが開く");
});

test("custom AI test timeout is not overwritten by the v2 migration", () => {
  const config = sanitizeAiTestConfig({
    version: 1,
    tests: [{
      id: "wasd_move",
      name: "WASD移動",
      description: "移動",
      expected: "変化",
      timeout: 90,
      enabled: true
    }]
  });

  assert.equal(config.tests[0].timeout, 90);
});

test("focused fixed-test prompts tell UI-TARS to finish quickly instead of exploring", () => {
  const wasd = buildUiTarsTestPrompt({
    id: "wasd_move",
    name: "WASD移動",
    description: "Wを押す",
    expected: "画面変化"
  }, {
    confirmedWindowTitle: "Deep Factory (DEBUG)",
    targetWindowConfirmed: true
  });
  const mouse = buildUiTarsTestPrompt({
    id: "mouse_click",
    name: "マウス視点",
    description: "右へ小さく動かす",
    expected: "視点変化"
  });

  assert.match(wasd, /Wキーを短く1回押し/);
  assert.match(wasd, /実際に検出・フォーカス済み/);
  assert.match(wasd, /Deep Factory \(DEBUG\)/);
  assert.match(wasd, /call_user\(\) を使わず/);
  assert.match(wasd, /3回以内/);
  assert.match(mouse, /右方向へ小さく1回/);
  assert.match(mouse, /クリック対象を探したり複数回クリックしたりせず/);
});


test("UI-TARS runtime fetch ignores the SDK request-timeout signal but preserves the Hub abort boundary", async () => {
  const hubController = new AbortController();
  const sdkController = new AbortController();
  sdkController.abort("sdk-30-second-timeout");

  let observedSignal = null;
  const runtimeFetch = createUiTarsRuntimeFetch(
    hubController.signal,
    async (_input, init = {}) => {
      observedSignal = init.signal;
      return { ok: true };
    }
  );

  await runtimeFetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    signal: sdkController.signal
  });

  assert.equal(observedSignal, hubController.signal);
  assert.equal(observedSignal.aborted, false);

  const emergencyController = new AbortController();
  const pendingFetch = createUiTarsRuntimeFetch(
    emergencyController.signal,
    async (_input, init = {}) => new Promise((resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new Error("hub-abort-reached-fetch")),
        { once: true }
      );
    })
  );

  const pending = pendingFetch("http://127.0.0.1:1234/v1/chat/completions");
  emergencyController.abort("emergency-stop");
  await assert.rejects(pending, /hub-abort-reached-fetch/);
});


test("Runtime Test Bridge verdicts use telemetry instead of screenshot interpretation", () => {
  const before = {
    schemaVersion: 1,
    sessionId: "session",
    sequence: 1,
    state: {
      ready: true,
      player: {
        position: [0, 0, 0],
        yaw: 0,
        pitch: 0
      }
    }
  };
  const moved = {
    ...before,
    sequence: 2,
    state: {
      ...before.state,
      player: {
        position: [0, 0, 0.4],
        yaw: 0,
        pitch: 0
      }
    }
  };
  const looked = {
    ...before,
    sequence: 3,
    state: {
      ...before.state,
      player: {
        position: [0, 0, 0],
        yaw: 0.1,
        pitch: 0
      }
    }
  };

  assert.equal(evaluateRuntimeBridgeTest("game_launch", before, before).status, "PASS");
  assert.equal(evaluateRuntimeBridgeTest("wasd_move", before, moved).status, "PASS");
  assert.equal(evaluateRuntimeBridgeTest("wasd_move", before, before).status, "FAIL");
  assert.equal(evaluateRuntimeBridgeTest("mouse_click", before, looked).status, "PASS");
  assert.equal(evaluateRuntimeBridgeTest("mouse_click", before, before).status, "FAIL");
});

test("Runtime Test Bridge reader requires the exact session and a newer sequence", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-bridge-"));
  const file = path.join(root, "state.json");

  await fs.writeFile(file, JSON.stringify({
    schemaVersion: 1,
    sessionId: "other-session",
    sequence: 8,
    state: { ready: true }
  }));

  const controller = new AbortController();
  const pending = waitForRuntimeTestBridgeState(file, "target-session", {
    afterSequence: 8,
    timeoutMs: 2000,
    signal: controller.signal
  });

  setTimeout(async () => {
    await fs.writeFile(file, JSON.stringify({
      schemaVersion: 1,
      sessionId: "target-session",
      sequence: 9,
      state: { ready: true }
    }));
  }, 100);

  const result = await pending;
  assert.equal(result.sessionId, "target-session");
  assert.equal(result.sequence, 9);
  await fs.rm(root, { recursive: true, force: true });
});

test("v3 fixed-test defaults migrate to Runtime Test Bridge descriptions", () => {
  const config = sanitizeAiTestConfig({
    version: 3,
    tests: [
      {
        id: "wasd_move",
        name: "WASD移動",
        description: "W/A/S/Dを使って短時間移動し、画面上の変化を確認する",
        expected: "プレイヤー、カメラ、座標など移動を示す画面変化が確認できる",
        timeout: 120,
        enabled: true
      },
      {
        id: "mouse_click",
        name: "マウス視点",
        description: "マウスを右方向へ小さく動かし、ゲーム内の視点変化を確認する",
        expected: "カメラまたは背景の見え方が変化し、マウスルックが反応していることを確認できる",
        timeout: 120,
        enabled: true
      }
    ]
  });

  assert.equal(config.version, 4);
  assert.match(config.tests[0].description, /Runtime Test Bridge/);
  assert.match(config.tests[1].expected, /Camera yaw/);
});
