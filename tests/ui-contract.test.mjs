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


test("safe stop explains recovery and keeps local Godot work available", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="safety-recovery"/);
  assert.match(html, /id="safety-changed-files"/);
  assert.match(html, /エラーではありません/);
  assert.match(html, /id="safety-save-button"/);
  assert.match(html, /id="safety-continue-button"/);
  assert.match(html, /id="safety-export-button"/);
  assert.match(source, /changedFileStatusLabel/);
  assert.match(source, /新しく作成/);
  assert.match(source, /Godotがファイルを識別するために作るID用ファイル/);
  assert.match(source, /renderSafetyRecovery/);
  assert.match(source, /repo\.dirty \|\| \(repo\.ahead \|\| 0\) > 0 \|\| !state\?\.network\?\.online/);
});

test("task selection shows concrete guidance instead of pretending work started", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="active-task-guide"/);
  assert.match(html, /id="active-task-steps"/);
  assert.match(html, /選んだだけでは作業開始・完了にはなりません/);
  assert.match(source, /今やるタスクを選びました/);
  assert.match(source, /このタスクの詳しい手順がRoadmapにまだ書かれていません/);
  assert.match(source, /completionCriteria/);
});


test("dirty task fallback explains stale local roadmap in plain Japanese", async () => {
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  assert.match(source, /PC側に変更があるため、HubがGitHubの最新版を取り込めていない可能性があります/);
  assert.doesNotMatch(source, /status\.textContent = file\.status \|\| "\?"/);
});


test("local changes can be reviewed and explicitly saved to GitHub", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="save-changes-dialog"/);
  assert.match(html, /id="save-changes-cancel-button"[^>]*type="button"/);
  assert.match(html, /id="confirm-save-changes-button"[^>]*type="submit"/);
  assert.match(html, /GitHubに保存/);
  assert.match(source, /saveRepositoryChanges/);
  assert.match(source, /openSaveChangesDialog/);
  assert.match(source, /GitHubへの送信待ち/);
  assert.match(source, /saveChangesCancel\.addEventListener\("click"/);
});


test("ChatGPT pack uses app data and tells ChatGPT to execute repository-side work", async () => {
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(mainSource, /appDataRoot\(\),\s*"chatgpt-packs"/);
  assert.doesNotMatch(
    mainSource,
    /app\.getPath\("documents"\),\s*"Game Dev Hub",\s*"ChatGPT Packs"/
  );
  assert.match(mainSource, /現在選択中のタスクを最優先で進めてください/);
  assert.match(mainSource, /そのままRepositoryへ反映してください/);
  assert.match(mainSource, /Userにしかできない確認だけをUserへ依頼してください/);
  assert.match(mainSource, /chatgptAction/);
});
