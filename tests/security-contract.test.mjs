import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mainSource = fs.readFileSync(new URL("../src/main.mjs", import.meta.url), "utf8");
const preloadSource = fs.readFileSync(new URL("../src/preload.cjs", import.meta.url), "utf8");
const repositorySource = fs.readFileSync(new URL("../src/services/repository.mjs", import.meta.url), "utf8");

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
  assert.doesNotMatch(preloadSource, /child_process|node:fs|spawn\s*\(|exec\s*\(/i);
  assert.match(preloadSource, /startDevelopment/);
  assert.match(preloadSource, /syncProject/);
  assert.match(preloadSource, /saveRepositoryChanges/);
  assert.match(preloadSource, /saveTaskVerification/);
  assert.match(preloadSource, /clearTaskVerification/);
  assert.match(preloadSource, /createFoundationProject/);
  assert.match(preloadSource, /updateProjectFoundation/);
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

test("development workspace IPC stays operation-specific", () => {
  assert.match(preloadSource, /setActiveTask/);
  assert.match(preloadSource, /listReferenceImages/);
  assert.match(preloadSource, /addReferenceImages/);
  assert.match(preloadSource, /removeReferenceImage/);
  assert.match(preloadSource, /openReferenceImage/);
  assert.match(preloadSource, /exportChatGptPack/);
  assert.doesNotMatch(preloadSource, /readFile|writeFile|copyFile|rm\(/);
});


test("GitHub save keeps privileged Git operations narrow and non-destructive", () => {
  assert.match(repositorySource, /\["add", "-A"\]/);
  assert.match(repositorySource, /\["commit", "-m", message\]/);
  assert.match(repositorySource, /\["push", "origin", "HEAD:" \+ project\.defaultBranch\]/);
  assert.match(repositorySource, /\["merge", "--no-edit", "origin\/" \+ project\.defaultBranch\]/);
  assert.doesNotMatch(repositorySource, /\["reset"/);
  assert.doesNotMatch(repositorySource, /\["clean"/);
  assert.doesNotMatch(repositorySource, /\["rebase"/);
  assert.doesNotMatch(repositorySource, /--force/);
});

test("GitHub save blocks likely secret files before staging", () => {
  assert.match(repositorySource, /isSensitiveRepositoryPath/);
  assert.match(repositorySource, /SENSITIVE_FILE_BLOCKED/);
});

test("AI desktop testing keeps privileged computer control behind operation-specific IPC", () => {
  const aiSource = fs.readFileSync(new URL("../src/services/ai-testing.mjs", import.meta.url), "utf8");

  assert.match(preloadSource, /getAiTestState/);
  assert.match(preloadSource, /runAiTest/);
  assert.match(preloadSource, /stopAiTest/);
  assert.match(preloadSource, /getAiTestDiagnostics/);
  assert.doesNotMatch(preloadSource, /mouse\.move|keyboard\.type|child_process|spawn\(/);
  assert.match(aiSource, /validateComputerAction/);
  assert.match(aiSource, /AI_TEST_WINDOW_SCOPE_VIOLATION/);
  assert.match(aiSource, /AI_TEST_STUCK_REPEAT/);
  assert.match(aiSource, /shell: false/);
  assert.doesNotMatch(aiSource, /exec\(/);
});
