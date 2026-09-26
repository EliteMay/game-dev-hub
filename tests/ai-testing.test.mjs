import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReproductionSteps,
  buildUiTarsTestPrompt,
  parseUiTarsFinished,
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
