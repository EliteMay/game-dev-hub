import test from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";

import {
  buildOpenAiModelsUrl,
  buildReproductionSteps,
  buildUiTarsTestPrompt,
  computerActionSource,
  maskScreenshotToWindow,
  normalizeMaskRegion,
  parseUiTarsFinished,
  probeOpenAiModelEndpoint,
  sanitizeAiTestConfig,
  summarizeAiTestResults,
  validateComputerAction
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
