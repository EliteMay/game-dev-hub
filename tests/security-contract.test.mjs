import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mainSource = fs.readFileSync(new URL("../src/main.mjs", import.meta.url), "utf8");
const preloadSource = fs.readFileSync(new URL("../src/preload.cjs", import.meta.url), "utf8");

test("renderer isolation is enabled", () => {
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /sandbox:\s*true/);
});

test("navigation and permissions are restricted", () => {
  assert.match(mainSource, /setWindowOpenHandler/);
  assert.match(mainSource, /will-navigate/);
  assert.match(mainSource, /setPermissionRequestHandler/);
});

test("preload exposes operation-specific API only", () => {
  assert.doesNotMatch(preloadSource, /exec|spawn|shell/i);
  assert.match(preloadSource, /startDevelopment/);
  assert.match(preloadSource, /syncProject/);
});

test("desktop foundation uses single-instance and bounded recovery surfaces", () => {
  assert.match(mainSource, /requestSingleInstanceLock\(\)/);
  assert.match(mainSource, /second-instance/);
  assert.match(mainSource, /render-process-gone/);
  assert.match(mainSource, /nativeTheme\.themeSource\s*=\s*"dark"/);
  assert.match(mainSource, /setAppDetails/);
});

test("network-dependent operations distinguish offline state", () => {
  assert.match(mainSource, /net\.isOnline\(\)/);
  assert.match(mainSource, /"OFFLINE"/);
});

test("diagnostic IPC remains operation-specific", () => {
  assert.match(preloadSource, /getDiagnostics/);
  assert.match(preloadSource, /exportDiagnostics/);
  assert.match(preloadSource, /openLogsFolder/);
  assert.match(preloadSource, /clearDiagnosticLogs/);
});
