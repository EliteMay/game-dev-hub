import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("package config enables stable GitHub Release updates", async () => {
  const pkg = JSON.parse(await fs.readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.version, "0.1.14");
  assert.equal(pkg.dependencies?.["electron-updater"], "6.8.9");
  assert.deepEqual(pkg.build?.publish, [{ provider: "github", owner: "EliteMay", repo: "game-dev-hub" }]);
  assert.equal(pkg.build?.win?.target?.[0]?.target, "nsis");
});

test("updater IPC surface stays explicit and narrow", async () => {
  const preload = await fs.readFile(new URL("src/preload.cjs", root), "utf8");
  const main = await fs.readFile(new URL("src/main.mjs", root), "utf8");
  for (const channel of ["hub:update-check", "hub:update-download", "hub:update-install", "hub:update-open-release"]) {
    assert.ok(preload.includes(channel) || main.includes(channel), channel + " missing");
  }
  assert.match(main, /autoUpdater\.autoDownload = false/);
  assert.match(main, /autoUpdater\.autoInstallOnAppQuit = false/);
  assert.match(main, /autoUpdater\.allowPrerelease = false/);
  assert.match(main, /github\.com\/EliteMay\/game-dev-hub\/releases\/latest/);
});

test("release workflow publishes updater metadata and installer together", async () => {
  const workflow = await fs.readFile(new URL(".github/workflows/release.yml", root), "utf8");
  assert.ok(workflow.includes("- main"));
  assert.ok(workflow.includes("gh release list"));
  assert.ok(workflow.includes("steps.release.outputs.tag"));
  assert.ok(workflow.includes("dist/latest.yml"));
  assert.ok(workflow.includes("dist/*.blockmap"));
  assert.ok(workflow.includes("dist/*.exe"));
  assert.ok(workflow.includes("gh release create"));
});

test("renderer exposes update status and explicit restart action", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  assert.match(html, /id="update-button"/);
  assert.match(html, /id="update-value"/);
  assert.match(source, /downloadUpdate\(\)/);
  assert.match(source, /installUpdate\(\)/);
  assert.match(source, /再起動して更新/);
});
