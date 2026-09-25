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
  assert.match(mainSource, /User実機確認結果まとめ/);
  assert.match(mainSource, /そのままRepositoryへ反映してください/);
  assert.match(mainSource, /Userに必要最小限の操作だけ案内してください/);
  assert.match(mainSource, /chatgptAction/);
});


test("task guidance shows who is responsible for the selected task", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="active-task-owner"/);
  assert.match(source, /担当: ChatGPT/);
  assert.match(source, /担当: あなた/);
  assert.match(source, /ChatGPT担当/);
  assert.match(source, /あなた担当/);
});


test("user-owned tasks expose step-by-step verification results and direct game launch", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="task-verification"/);
  assert.match(html, /id="task-verification-steps"/);
  assert.match(html, /id="task-verification-note"/);
  assert.match(html, /id="task-run-game-button"/);
  assert.match(source, /できた/);
  assert.match(source, /できなかった/);
  assert.match(source, /今は確認できない/);
  assert.match(source, /saveTaskVerification/);
  assert.match(source, /clearTaskVerification/);
  assert.match(source, /saveVerificationChoice/);
  assert.match(source, /ゲーム起動/);
  assert.match(source, /確認結果はHubに自動保存されます/);
});

test("completed and future roadmap tasks use progressive disclosure", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="task-toggle-completed-button"/);
  assert.match(html, /id="task-toggle-future-button"/);
  assert.match(source, /showCompletedTasks/);
  assert.match(source, /showFutureTasks/);
  assert.match(source, /完了済みを表示/);
  assert.match(source, /今後のタスクを表示/);
  assert.match(source, /futureOpenCount/);
  assert.match(source, /visibleTasks = section\.tasks\.filter/);
});


test("ChatGPT panel aggregates all user verification results into one shared pack", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const renderer = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(html, /id="verification-overview-counts"/);
  assert.match(html, /id="verification-overview-list"/);
  assert.match(html, /確認結果をまとめてChatGPTへ/);
  assert.match(renderer, /renderVerificationOverview/);
  assert.match(renderer, /allUserVerificationRows/);
  assert.match(renderer, /複数タスクを確認したあと/);
  assert.match(mainSource, /allUserTaskResults/);
  assert.match(mainSource, /verificationSummary/);
  assert.match(mainSource, /User実機確認結果まとめ/);
  assert.match(mainSource, /schemaVersion: 3/);
});


test("completed user verification tasks are not shown as actionable re-checks", async () => {
  const renderer = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const verification = await fs.readFile(new URL("src/services/task-verification.mjs", root), "utf8");
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(renderer, /task\.owner === "user" && !task\.done/);
  assert.match(verification, /completedInRoadmap \? "completed"/);
  assert.match(mainSource, /Roadmap完了済み（再確認不要）/);
  assert.match(mainSource, /!item\.doneInRoadmap && item\.result\?\.overall === "stale"/);
});

test("Foundation starter flow is explicit and preserves required-field cancel recovery", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="create-foundation-project-button"/);
  assert.match(html, /id="foundation-create-dialog"/);
  assert.match(html, /id="foundation-game-name-input"[^>]*required/);
  assert.match(html, /id="foundation-repository-url-input"[^>]*required/);
  assert.match(html, /id="foundation-create-close-button"[^>]*type="button"/);
  assert.match(html, /id="foundation-create-cancel-button"[^>]*type="button"/);
  assert.match(html, /Fileのない空Repository/);
  assert.match(html, /既存FileがあるRepositoryは上書きせず停止/);
  assert.match(source, /createFoundationProject/);
  assert.match(source, /foundationCreateError/);
  assert.match(source, /Foundation付きゲーム作成/);
});

test("selected game shows installed Foundation version and explicit update action", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="foundation-value"/);
  assert.match(html, /id="foundation-description"/);
  assert.match(html, /id="foundation-update-button"/);
  assert.match(source, /project\.foundation/);
  assert.match(source, /導入Commit/);
  assert.match(source, /updateProjectFoundation/);
});
