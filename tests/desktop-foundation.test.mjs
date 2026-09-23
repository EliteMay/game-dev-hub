import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendFoundationLog,
  clearFoundationLogs,
  foundationDataPath,
  migrateLegacyUserData,
  readRecentFoundationLogs,
  redactHomePath,
  resolveWindowPlacement
} from "../src/services/desktop-foundation.mjs";
import { sanitizeSettings } from "../src/services/settings.mjs";

test("settings schema v3 keeps desktop and development state", () => {
  const safe = sanitizeSettings({
    projectsRoot: path.resolve("C:/Games"),
    godotPath: path.resolve("C:/Godot/Godot.exe"),
    lastSelectedProjectId: "deep-factory",
    activeTaskByProject: { "deep-factory": "task-123" },
    window: {
      width: 1500,
      height: 900,
      x: 200,
      y: 100,
      maximized: true
    }
  });

  assert.equal(safe.version, 3);
  assert.equal(safe.lastSelectedProjectId, "deep-factory");
  assert.equal(safe.activeTaskByProject["deep-factory"], "task-123");
  assert.equal(safe.window.width, 1500);
  assert.equal(safe.window.height, 900);
  assert.equal(safe.window.x, 200);
  assert.equal(safe.window.y, 100);
  assert.equal(safe.window.maximized, true);
});

test("legacy userData files are copied into the app-specific data directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-"));
  try {
    await fs.writeFile(path.join(root, "settings.json"), "{\"version\":1}\n", "utf8");
    await fs.writeFile(path.join(root, "projects.json"), "{\"version\":1,\"projects\":[]}\n", "utf8");

    const migrated = await migrateLegacyUserData(root);
    assert.equal(migrated.dataPath, foundationDataPath(root));
    assert.deepEqual(migrated.copied.sort(), ["projects.json", "settings.json"]);
    assert.equal(await fs.readFile(path.join(root, "settings.json"), "utf8"), "{\"version\":1}\n");
    assert.equal(await fs.readFile(path.join(migrated.dataPath, "settings.json"), "utf8"), "{\"version\":1}\n");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("window placement is clamped back into the visible work area", () => {
  const placed = resolveWindowPlacement(
    { width: 1400, height: 900, x: 99999, y: -99999 },
    { x: 0, y: 0, width: 1920, height: 1040 }
  );

  assert.equal(placed.width, 1400);
  assert.equal(placed.height, 900);
  assert.equal(placed.x, 520);
  assert.equal(placed.y, 0);
});

test("diagnostic logs are bounded records and can be cleared", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-logs-"));
  try {
    await appendFoundationLog(root, {
      event: "test.event\nignored-line",
      details: {
        channel: "hub:test",
        ok: true
      }
    });

    const logs = await readRecentFoundationLogs(root, 10);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].event, "test.event ignored-line");
    assert.equal(logs[0].details.channel, "hub:test");

    await clearFoundationLogs(root);
    assert.deepEqual(await readRecentFoundationLogs(root, 10), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("diagnostic paths redact the user home prefix", () => {
  const home = path.resolve("C:/Users/tester");
  const target = path.join(home, "Documents", "Game Dev Hub");
  const redacted = redactHomePath(target, home);

  assert.match(redacted, /^%HOME%/);
  assert.doesNotMatch(redacted, /tester/i);
});

test("unrecoverable JSON is quarantined before safe fallback is recreated", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-corrupt-"));
  const filePath = path.join(root, "settings.json");

  try {
    await fs.writeFile(filePath, "{broken", "utf8");
    await fs.writeFile(filePath + ".backup.json", "{also-broken", "utf8");

    const { readJsonRecovering } = await import("../src/services/storage.mjs");
    const loaded = await readJsonRecovering(filePath, { version: 2 });

    assert.equal(loaded.fallbackUsed, true);
    assert.deepEqual(loaded.value, { version: 2 });
    assert.equal(await fs.readFile(filePath + ".corrupt.json", "utf8"), "{broken");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
