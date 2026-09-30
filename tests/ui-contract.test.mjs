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
  assert.match(html, /id="task-verification-pass-all-button"/);
  assert.match(html, /すべてできた/);
  assert.match(html, /id="task-run-game-button"/);
  assert.match(source, /できた/);
  assert.match(source, /できなかった/);
  assert.match(source, /今は確認できない/);
  assert.match(source, /saveTaskVerification/);
  assert.match(source, /clearTaskVerification/);
  assert.match(source, /saveVerificationChoice/);
  assert.match(source, /saveAllVerificationPassed/);
  assert.match(source, /optimisticVerificationRecord/);
  assert.match(source, /verificationSaveChains/);
  assert.match(source, /ゲーム起動/);
  assert.match(source, /確認結果はHubに自動保存されます/);
});


test("task verification save avoids rebuilding the full Hub state for every click", async () => {
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");
  const match = mainSource.match(
    /async function saveManualTaskVerification\(payload\) \{([\s\S]*?)\n\}/
  );

  assert.ok(match, "saveManualTaskVerification must exist");
  assert.match(match[1], /loadTaskVerifications/);
  assert.match(match[1], /existing && !existing\.stale && existing\.repositoryCommit/);
  assert.doesNotMatch(match[1], /state:\s*await getState\(\)/);
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
  assert.match(mainSource, /schemaVersion: 4/);
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

test("Foundation starter flow defaults to local prototypes and can opt into GitHub", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const preload = await fs.readFile(new URL("src/preload.cjs", root), "utf8");
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(html, /id="create-foundation-project-button"/);
  assert.match(html, /id="foundation-create-dialog"/);
  assert.match(html, /id="foundation-create-mode-select"/);
  assert.match(html, /value="local">ローカル試作（Repository不要）/);
  assert.match(html, /value="github">GitHubで正式管理/);
  assert.match(html, /id="foundation-profile-select"[^>]*required/);
  assert.match(html, /id="foundation-profile-description"/);
  assert.match(html, /id="foundation-game-name-input"[^>]*required/);
  assert.match(html, /class="field hidden" id="foundation-repository-field"/);
  assert.match(html, /id="foundation-repository-url-input"/);
  assert.doesNotMatch(html, /id="foundation-repository-url-input"[^>]*required/);
  assert.match(html, /GitHub Repositoryは不要/);
  assert.match(html, /id="publish-local-dialog"/);
  assert.match(html, /id="publish-local-url-input"[^>]*required/);
  assert.match(source, /renderFoundationCreationMode/);
  assert.match(source, /mode === "local" \? "ローカル試作作成"/);
  assert.match(source, /profileId: el\.foundationProfileSelect\.value/);
  assert.match(source, /publishLocalPrototype/);
  assert.match(source, /ローカル履歴に保存/);
  assert.match(preload, /hub:get-foundation-profiles/);
  assert.match(preload, /hub:publish-local-prototype/);
  assert.match(mainSource, /bootstrapLocalFoundationProject/);
  assert.match(mainSource, /localPrototypeDestination/);
  assert.match(mainSource, /hub:publish-local-prototype/);
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

test("auto-test tab makes deterministic fixed tests primary and keeps AI exploration experimental", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const preload = await fs.readFile(new URL("src/preload.cjs", root), "utf8");

  assert.match(html, /id="auto-test-tab-button"/);
  assert.match(html, /id="ai-test-start"/);
  assert.match(html, /id="ai-test-retest-failed"/);
  assert.match(html, /id="ai-test-exploration"/);
  assert.match(html, /id="ai-test-emergency-stop"/);
  assert.match(html, /id="ai-test-diagnostic-list"/);
  assert.match(html, /id="ai-test-result-list"/);
  assert.match(html, /id="ai-test-history-list"/);
  assert.match(source, /renderAiTestReport/);
  assert.match(source, /onAiTestProgress/);
  assert.match(html, /固定テスト開始/);
  assert.match(html, /Runtime Test Bridge/);
  assert.match(html, /AI探索（実験）/);
  assert.match(html, /自動テストを停止/);
  assert.match(source, /stopAiTest/);
  assert.match(preload, /hub:ai-test-stop/);
});

test("AI settings disclose provider cost key state and local alternative", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(html, /id="ai-test-service-name"/);
  assert.match(html, /id="ai-test-service-mode"/);
  assert.match(html, /id="ai-test-service-key"/);
  assert.match(html, /id="ai-test-service-cost"/);
  assert.match(html, /id="ai-test-service-local"/);
  assert.match(source, /renderAiServiceCost/);
  assert.match(source, /API課金 ¥0/);
  assert.match(source, /Provider依存/);
  assert.match(source, /開始前に毎回確認/);
});


test("project tab visibility does not override conditional component hidden state", async () => {
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const css = await fs.readFile(new URL("src/renderer/styles.css", root), "utf8");

  const match = source.match(/function renderProjectTab\(\) \{([\s\S]*?)\n\}/);
  assert.ok(match, "renderProjectTab must exist");
  assert.match(match[1], /node\.classList\.toggle\("project-tab-hidden", !development\)/);
  assert.doesNotMatch(match[1], /node\.classList\.toggle\("hidden", !development\)/);
  assert.match(css, /\.project-tab-hidden\s*\{[\s\S]*?display:\s*none\s*!important/);
});


test("AI first-run UI explains Godot direct launch and model diagnostics", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const renderer = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(html, /テスト起動対象/);
  assert.match(html, /別の\.exeを選択/);
  assert.match(renderer, /Godot開発実行/);
  assert.match(renderer, /Windows Export不要/);
  assert.match(renderer, /Model名まで確認/);
  assert.match(renderer, /緊急停止: /);
  assert.match(mainSource, /launchArgs: \["--path", project\.localPath\]/);
  assert.match(mainSource, /UI_TARS_MODEL_NOT_FOUND/);
  assert.match(mainSource, /AI_TEST_EMERGENCY_SHORTCUT_DISPLAY = "Ctrl \+ Shift \+ F12"/);
});


test("AI test runtime uses the resolved model id without manual config edits", async () => {
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");
  assert.match(mainSource, /const runtimeConfig = endpoint\.resolvedModel/);
  assert.match(mainSource, /config: runtimeConfig/);
  assert.match(mainSource, /configuredModel: config\.uiTars\.model/);
  assert.match(mainSource, /resolvedModel: endpoint\.resolvedModel/);
});


test("Foundation source repository is not shown as an uninstalled game", async () => {
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");

  assert.match(source, /EliteMay\/godot-game-foundation/);
  assert.match(source, /Foundation本体/);
  assert.match(source, /共通基盤そのものです。Game Foundationの導入対象ではありません/);
});


test("Hub can register and present Web / Electron projects without Godot-only wording", async () => {
  const html = await fs.readFile(new URL("src/renderer/index.html", root), "utf8");
  const source = await fs.readFile(new URL("src/renderer/app.js", root), "utf8");
  const mainSource = await fs.readFile(new URL("src/main.mjs", root), "utf8");

  assert.match(html, /id="project-engine-select"/);
  assert.match(html, /value="web">Web \/ Electron/);
  assert.match(source, /engine: el\.engineInput\.value/);
  assert.match(source, /webProject = project\.engine === "web"/);
  assert.match(source, /Web \/ Electron ProjectではGodot Game Foundationを使用しません/);
  assert.match(mainSource, /payload\.engine === PROJECT_ENGINE_WEB/);
  assert.match(mainSource, /project\.engine === PROJECT_ENGINE_WEB/);
  assert.match(mainSource, /runWebProject\(project\)/);
});
