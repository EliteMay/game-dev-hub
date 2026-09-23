import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("add dialog cancel controls bypass required-field validation", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");

  assert.match(
    html,
    /id="add-dialog-close-button"[^>]*type="button"/,
    "close button must not submit the required form"
  );
  assert.match(
    html,
    /id="add-dialog-cancel-button"[^>]*type="button"/,
    "cancel button must not submit the required form"
  );
});

test("renderer wires explicit dialog close handlers", async () => {
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(source, /addDialogClose\.addEventListener\("click"/);
  assert.match(source, /addDialogCancel\.addEventListener\("click"/);
  assert.match(source, /removeDialogCancel\.addEventListener\("click"/);
});

test("Windows build uses the custom Game Dev Hub icon", async () => {
  const pkg = JSON.parse(await fs.readFile(new URL("package.json", root), "utf8"));
  const icon = await fs.readFile(new URL("build/icon.svg", root), "utf8");

  assert.equal(pkg.build?.win?.icon, "build/icon.svg");
  assert.match(icon, /<svg[\s>]/);
});

test("desktop foundation UI exposes network diagnostics and real task state", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="network-value"/);
  assert.match(html, /id="diagnostics-button"/);
  assert.match(html, /id="diagnostics-export-button"/);
  assert.match(html, /id="task-status"/);
  assert.match(source, /処理中:/);
  assert.match(source, /オフライン \/ ローカル操作可/);
});

test("development workspace exposes repository tasks reference images and ChatGPT pack", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="development-task-list"/);
  assert.match(html, /id="export-chatgpt-pack-button"/);
  assert.match(html, /id="add-reference-image-button"/);
  assert.match(html, /Repositoryを更新すると自動で変わります/);
  assert.match(source, /setActiveTask/);
  assert.match(source, /exportChatGptPack/);
  assert.match(source, /renderReferenceImages/);
});
