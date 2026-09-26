import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultAutoTestConfig,
  listAutoTestRuns,
  loadAutoTestConfig,
  sanitizeAutoTestConfig,
  saveAutoTestConfig,
  saveAutoTestReport
} from "../src/services/auto-test.mjs";

test("auto test config sanitizes executable model and tests without persisting secrets", () => {
  const safe = sanitizeAutoTestConfig({
    engine: "ui-tars",
    exePath: path.resolve("C:/Games/TestGame.exe"),
    launchArgs: ["--debug", "", "  --safe  "],
    timeout: 9999,
    maxAgentSteps: 999,
    model: {
      baseURL: "http://127.0.0.1:8000/v1/",
      name: "ui-tars"
    },
    apiKey: "must-not-persist",
    tests: [
      {
        id: "Mining Pickup",
        name: "採掘して拾う",
        description: "鉱石を壊して拾う",
        expected: "石が増える",
        timeout: 60
      }
    ]
  });

  assert.equal(safe.engine, "ui-tars");
  assert.match(safe.exePath, /TestGame\.exe$/i);
  assert.deepEqual(safe.launchArgs, ["--debug", "--safe"]);
  assert.equal(safe.timeout, 900);
  assert.equal(safe.maxAgentSteps, 80);
  assert.equal(safe.model.baseURL, "http://127.0.0.1:8000/v1");
  assert.equal(safe.tests[0].id, "mining_pickup");
  assert.equal("apiKey" in safe, false);
  assert.equal("apiKey" in safe.model, false);
});

test("auto test config uses versioned app data storage and recovers defaults", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-auto-test-"));
  try {
    const defaults = await loadAutoTestConfig(root, "example-game");
    assert.equal(defaults.schemaVersion, 1);
    assert.equal(defaults.engine, "ui-tars");
    assert.ok(defaults.tests.length >= 1);

    const saved = await saveAutoTestConfig(root, "example-game", {
      ...defaultAutoTestConfig(),
      targetVersion: "0.2.0"
    });
    assert.equal(saved.targetVersion, "0.2.0");

    const disk = JSON.parse(await fs.readFile(
      path.join(root, "auto-tests", "example-game", "config.json"),
      "utf8"
    ));
    assert.equal(disk.targetVersion, "0.2.0");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("auto test history records PASS FAIL WARNING UNKNOWN summaries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-auto-history-"));
  try {
    await saveAutoTestReport(root, "example-game", {
      testRunId: "2026-09-26-test",
      testedAt: "2026-09-26T11:00:00.000Z",
      engine: "UI-TARS",
      gitCommit: "abc123",
      targetVersion: "0.1.0",
      tests: [
        { status: "PASS" },
        { status: "FAIL" },
        { status: "WARNING" },
        { status: "UNKNOWN" }
      ]
    });

    const history = await listAutoTestRuns(root, "example-game");
    assert.equal(history.length, 1);
    assert.deepEqual(
      {
        total: history[0].total,
        passed: history[0].passed,
        failed: history[0].failed,
        warning: history[0].warning,
        unknown: history[0].unknown
      },
      { total: 4, passed: 1, failed: 1, warning: 1, unknown: 1 }
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("auto test runner preserves safety boundaries in source", async () => {
  const source = await fs.readFile(new URL("../src/services/auto-test.mjs", import.meta.url), "utf8");

  assert.match(source, /shell:\s*false/);
  assert.match(source, /getActiveAutoTestState/);
  assert.match(source, /targetMatches/);
  assert.match(source, /ゲームウィンドウ外へのマウス操作/);
  assert.match(source, /Windows全体へ影響するショートカット/);
  assert.match(source, /sameActionLimit/);
  assert.match(source, /unchangedScreenLimit/);
  assert.match(source, /report_unknown/);
  assert.doesNotMatch(source, /exec\s*\(/);
  assert.doesNotMatch(source, /git\s+push/i);
});
