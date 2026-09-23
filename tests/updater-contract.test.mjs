import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("auto updater dependency and GitHub publish provider are configured", async () => {
  const pkg = JSON.parse(await fs.readFile(new URL("package.json", root), "utf8"));

  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.dependencies?.["electron-updater"], "6.8.9");
  assert.equal(pkg.build?.publish?.[0]?.provider, "github");
  assert.equal(pkg.build?.publish?.[0]?.owner, "EliteMay");
  assert.equal(pkg.build?.publish?.[0]?.repo, "game-dev-hub");
  assert.equal(pkg.build?.electronUpdaterCompatibility, ">=2.16");
});

test("updater keeps download and restart user-controlled", async () => {
  const source = await fs.readFile(new URL("src/services/updater.mjs", root), "utf8");

  assert.match(source, /autoUpdater\.autoDownload = false/);
  assert.match(source, /autoUpdater\.autoInstallOnAppQuit = false/);
  assert.match(source, /autoUpdater\.quitAndInstall\(false, true\)/);
  assert.match(source, /allowPrerelease = false/);
});

test("renderer only receives narrow updater bridge methods", async () => {
  const preload = await fs.readFile(new URL("src/preload.cjs", root), "utf8");
  const main = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(preload, /checkForUpdates:/);
  assert.match(preload, /downloadUpdate:/);
  assert.match(preload, /installUpdate:/);
  assert.doesNotMatch(preload, /setFeedURL/);

  assert.match(main, /registerIpc\("hub:check-for-updates"/);
  assert.match(main, /registerIpc\("hub:download-update"/);
  assert.match(main, /registerIpc\("hub:install-update"/);
});

test("release workflow publishes only version tags with write permission", async () => {
  const workflow = await fs.readFile(new URL(".github/workflows/release.yml", root), "utf8");

  assert.match(workflow, /tags:\s*\n\s*- "v\*"/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /npm run release:win/);
  assert.match(workflow, /GH_TOKEN:/);
});
