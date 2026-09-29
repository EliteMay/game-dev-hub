# 作業報告書

## 今回変更した内容

- Game Dev Hub v0.1.15にWindowsゲーム向けAI自動テストの第1段階を追加。
- UI-TARSをPrimary Computer Use engineとして統合。
- Game exe起動、対象Window検出、WASD / Mouse操作、Screenshot Evidence、PASS / FAIL / WARNING / UNKNOWN、履歴、FAIL再テスト、探索テスト、診断、緊急停止を追加。
- 最新AI Test JSONとEvidence Screenshotを既存ChatGPT共有Packへ統合。
- 外部AI endpoint利用時はScreenshot / test instructionの外部送信とProvider課金可能性を開始前に明示し、User確認なしでは実行しない。
- API KeyはElectron safeStorageで暗号化し、plain settings / Repository / Log / ChatGPT Packへ保存しない。
- AIへ渡すScreenshotはActive Target Game Window領域以外を黒塗りし、Maskに失敗した場合はDesktop全体を送らず停止する。
- UI-TARS公式NutJS Operatorのcurrent action vocabularyへAllowlistを同期し、正常なGame操作を誤停止しないよう修正。

## 変更したファイル

### 新規

- `src/services/ai-testing.mjs`
- `tests/ai-testing.test.mjs`
- `WORK_REPORT.md`

### 更新

- `README.md`
- `REQUIREMENTS.md`
- `PROJECT_RULES.md`
- `PROJECT_LEARNINGS.md`
- `docs/ARCHITECTURE.md`
- `package.json`
- `src/main.mjs`
- `src/preload.cjs`
- `src/renderer/index.html`
- `src/renderer/app.js`
- `src/renderer/styles.css`
- `tests/security-contract.test.mjs`
- `tests/ui-contract.test.mjs`
- `tests/updater-contract.test.mjs`

### 削除

- なし

## 修正した不具合

- UI-TARSのAbortSignalをSDK contractに合わせ、Emergency stop / timeoutでAgent runを停止できるよう修正。
- Computer Use安全判定がAI thought全文を解析して通常Game操作を誤停止し得る問題を修正し、実行対象の `action_type / action_inputs` だけを判定するよう変更。
- System shortcut、範囲外Window、同一操作反復を停止するGuardを追加。
- External UI-TARS endpointでUser確認なしに画面送信が始まり得る経路を閉鎖。
- Action scopeだけを制限し、AI visual inputがDesktop全体のままだったPrivacy gapを修正。
- UI-TARS標準Action名の一部がAllowlist外だったCompatibility gapを修正。

## 追加した機能

- 「自動テスト」タブ
- Projectごとのexe path / launch args / window title / target version / timeout / AI engine / endpoint / model / test definitions
- UI-TARS SDK + NutJS Computer Use
- Game Window scope guard
- PASS / FAIL / WARNING / UNKNOWN + Confidence
- Before / After / FAIL Screenshot
- Action log / Runtime log tail / Reproduction steps
- FAIL only retest
- AI exploration test
- Test history
- AI diagnostics with cause / recovery
- Emergency stop button + Ctrl + Shift + F12
- External AI consent
- Service / Local・External / API Key state / Cost guidance / Local alternative display
- ChatGPT PackへのAI Test Evidence統合
- Target Game Window外Pixel Mask
- UI-TARS official NutJS action vocabulary compatibility

## 削除した内容

- なし

## Known Failure Preflight

- 実施: Yes
- 検索対象: `PROJECT_LEARNINGS.md` / current Security boundary / Electron rules / current tests
- Targeted Search: Rendererへのprivileged capability公開、Computer Use暴走、external data send、API key storage、timeout / repeat loop
- 該当Learning: GL-018 Computer UseをRendererへ直接公開しない
- 今回のPrevention: operation-specific IPC / Main Process Safe Operator / Target Window allowlist / action validation / AbortController / safeStorage / external consent
- Regression Guard: `tests/ai-testing.test.mjs` / `tests/security-contract.test.mjs` / `tests/ui-contract.test.mjs`
- 追加Prevention: Action Scope / Visual Scope / Data Egress Scopeを別Boundaryとして検証

## 保存・互換性への影響

- Schema変更: AI Test config / report専用schemaを追加。既存Project schemaは変更なし。
- Storage Key変更: なし。
- IndexedDB変更: なし。
- Migration: 不要。
- Backup / Recovery: AI Test config / reportは既存atomic JSON storageを利用。
- 既存URLへの影響: なし。

## GitHub Pagesへの影響

- Electron-onlyのためNot applicable。

## Visual Quality

- User-facing UI: Yes
- Visual Ambition: baseline
- Visual Quality Baseline: Not verified
- 最終Visual確認: Not verified
- 主Viewport: Windows desktop
- Blocking / Major Finding: UI contract testは成功。実Windows画面での最終visual確認は未実施。

## 自動確認

- [x] JS / MJS構文をNode test経由で確認
- [x] JSON / config contract
- [x] Data / Schema整合のUnit Test
- [x] Unit Test
- [x] Windows installer build
- [x] Updater artifact verification
- [x] UI-TARS official action vocabulary regression
- [x] Target-window screenshot pixel masking unit test
- [ ] Real Windows Game E2E

## 実ブラウザ・実機確認

- [ ] Windows上でv0.1.15をインストール
- [ ] UI-TARS Model Serverへ接続
- [ ] 実Game .exeを起動
- [ ] Target Window検出
- [ ] WASD / Mouse操作
- [ ] Screenshot / Result / History / ChatGPT Pack確認
- [ ] Emergency stop実機確認

## 確認できたこと

- PR #19 final CI成功後mainへmerge。
- v0.1.13 Release成功。
- External AI consent / cost disclosure / action payload hardeningをPR #20で追加。
- PR #20 final CIでNode tests / Windows installer build / updater artifact verification / artifact uploadがすべて成功。
- PR #20をmainへmerge。
- main CI成功。
- PR #21でUI-TARS Action vocabulary同期とTarget Window外Pixel Maskを追加し、Node tests / Windows installer build / updater artifact verification / artifact uploadがすべて成功。
- PR #21をmainへmerge。
- v0.1.15 main CI成功。
- v0.1.15 Release workflow成功。
- v0.1.15 Releaseと `game_dev_hub_0.1.15_setup.exe` / blockmap / latest.yml の生成を確認。

## 確認できていないこと

- 実User Windows環境でのUI-TARS Model接続。
- 実Game Windowに対するWASD / Mouse Computer Use。
- UI-TARS Desktopのsingle-monitor前提を含むmulti-monitor挙動。
- Game固有の採掘 / item pickup / inventory数値等の高度な判定精度。
- Emergency stop shortcutの実機反応。
- Visual最終確認。

## 未完了

- Agent-S実行Adapterは未接続。UI-TARSで要件を満たせない場合のFallback候補としてUIだけ残している。
- Emergency shortcutのUser変更UIは未実装。
- Screenshot保存先の任意Folder指定は未実装。安全のためApp Data固定。
- 録画は将来拡張用の構造のみで未実装。

## 既知の問題

- UI-TARS Desktop公式はsingle-monitor前提の注意があるため、初期実機確認は1画面構成を推奨。
- Cloud Providerの具体料金はProvider依存で、Game Dev Hubから自動算出しない。
- CIは実Game Computer Useそのものを実行していないため、Phase 1の最終完成判定にはWindows実機Playtestが残る。

## 今後必要な作業

1. v0.1.15をWindowsへ更新 / install。
2. 自動テストタブでLocal UI-TARS endpointを設定。
3. Test target .exe / Window titleを設定。
4. 診断を実行。
5. まずGame起動 + WASD + Mouse clickの最小Testを実機で成功させる。
6. 結果JSON / Screenshot / History / ChatGPT Packを確認。
7. そのEvidenceを基に採掘・item pickup・inventory等のGame固有Testを増やす。


---

## v0.1.16 Safety panel visibility fix

### 症状

- Repository表示は `main / 変更なし`
- changedCountは0
- それでも「GitHubへの保存待ち / PC側に変更があります」Panelが表示され続けた

### Root Cause

`renderSafetyRecovery()` はclean RepositoryでPanelへ `.hidden` を付けていたが、その後 `renderProjectTab()` が開発Tab内の全要素から同じ `.hidden` を外していた。

### 修正

- Tab専用 `.project-tab-hidden` を追加
- `renderProjectTab()` はTab visibilityだけを変更
- Safety panelの `.hidden` はRepository stateだけで管理
- UI contract testへRegression Guardを追加

### Validation

- Node tests: CIで確認
- Windows installer build: CIで確認
- updater artifact verification: CIで確認
- User screenshotで発生状態は確認済み
- 修正版のWindows実画面はRelease後に未確認


---

## v0.1.17 AI Test First-Run Readiness

### User実機画面から確認したこと

- Game Dev Hub v0.1.16へ更新済み
- Deep Factoryの「自動テスト」Tab表示は正常
- Test target .exeは未設定
- Deep Factory RepositoryにはWindows Export presetがまだ無く、開発中Gameへexe選択を要求するFlowが初回テストのBlocker
- UI-TARS Base URLはloopbackだが、UI-TARS Model自体の稼働確認は未実施

### Root Cause / Gap

- 自動テストが「Windows game.exeが存在すること」を初期前提にしていた
- Endpoint診断がBase URLへGETできるだけで成功とし、HTTP Errorや別Model Serverを識別していなかった

### 変更

- Godot executable + `--path <project>` をpre-export GameのDefault AI Test targetに追加
- 明示的にWindows .exeを選んだ場合はGodot用launch argsを解除
- OpenAI互換 `/models` と設定Model IDを照合する診断を追加
- HTTP 404等をReady扱いしない
- UIへGodot direct runとModel readinessの説明を追加
- Emergency shortcut表示をWindows向けに `Ctrl + Shift + F12` と表示

### Validation

- Unit / contract tests: CIで確認
- Windows installer build: CIで確認
- updater artifact verification: CIで確認
- Deep Factory Godot direct run + actual UI-TARS Computer Use: Windows実機確認待ち


---

## v0.1.18 UI-TARS runtime dependency fix

### User実機Evidence

自動テスト診断で次を確認:

- UI-TARS: NG
- Error: `Cannot find package 'uuid' imported from .../resources/app.asar/node_modules/@ui-tars/sdk/dist/GUIAgent.mjs`
- Godot direct test launch / screenshot / keyboard / mouse / safeStorageはOK

### Root Cause

`@ui-tars/sdk@1.2.3` の `GUIAgent` は `uuid` をruntime importするが、upstream SDK package.jsonは `uuid` をdependenciesへ宣言していない。

Development installでは別依存から `uuid` が見えていたためNode testは通ったが、Electron Builderがproduction dependencyだけをPackageした結果、Setup.exe内では `uuid` が欠落した。

### 修正

- `uuid@9.0.1` をHubのproduction dependencyへ追加
- Runtime import Regression Testを追加
- CI / Releaseへproduction dependency graph checkを追加
- Project Rule / LearningへPackaging boundaryを記録
- Versionをv0.1.18へ更新

### Validation

- Node tests: PASS
- Production dependency graph: CI / ReleaseでPASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #24をmainへmerge済み
- v0.1.18 main CI: PASS
- v0.1.18 Release workflow: PASS
- `game_dev_hub_0.1.18_setup.exe` / blockmap / latest.yml の生成を確認
- v0.1.18実機のUI-TARS SDK診断: User Windows環境で再確認待ち


---

## v0.1.19 UI-TARS Model ID compatibility

### User実機Evidence

LM Studio Serverは `GET /v1/models` へ正常応答し、Loaded Model一覧に `ui-tars-1.5-7b` が存在した。一方、Game Dev Hubの既存設定は `ui-tars-1.5` のため診断がNGになった。

### Root Cause

HubがUI-TARS product/family名をOpenAI互換APIのModel IDとして固定していた。LM Studioが返すRuntime IDは `ui-tars-1.5-7b`。

### 修正

- 新規Default Modelを `ui-tars-1.5-7b` へ変更
- 旧Default `ui-tars-1.5` は一意な `ui-tars-1.5-*` 候補へだけ自動解決
- AI実行時にresolved Model IDを使用
- Test reportへconfigured / resolved / match typeを保存
- 複数候補では自動選択しないRegression Guardを追加
- Versionをv0.1.19へ更新

### Validation

- Unit / contract tests: PASS
- Legacy alias / ambiguous alias regression: PASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #25をmainへmerge済み
- v0.1.19 main CI: PASS
- v0.1.19 Release workflow: PASS
- `game_dev_hub_0.1.19_setup.exe` / blockmap / latest.yml の生成を確認
- v0.1.19実機でUI-TARS診断がOKになること: User Windows環境で再確認待ち


---

## v0.1.20 UI-TARS completion reliability

### User実機Evidence

最初のDeep Factory AI Computer Use Testで次を確認:

- ゲーム起動: PASS / Confidence high
- WASD移動: UNKNOWN / Test timeout
- マウス操作: UNKNOWN / AIから機械可読な最終判定を取得できず
- Deep Factory Window検出とGodot direct launch自体は成功

### Root Cause

UI-TARS SDKの `onData.data.conversations` はdelta Eventで、各GPT Responseの `predictionParsed` にActionが入る。HubはCallback Eventを文字列化し、最後のEventだけを保存していた。

SDKは終了時に `conversations: []` のstatus Eventを送るため、直前の `finished(content='...')` を失い、Mouse TestがUNKNOWNになった。

WASDについては旧Default timeout 45秒がLocal UI-TARS 7Bの操作 + 次画面確認 + finishedまでに不足した。

### 修正

- `predictionParsed` の `finished` Actionを構造化Parserで取得
- Final resultをCallback間で保持
- JSONでないfinished contentもUNKNOWNとして内容を保持
- WASD / Mouse Default timeoutを120秒へ変更
- Config v1の旧Default 45秒だけをMigration
- User custom timeoutは保持
- Fixed Test Promptを短いSmoke Test向けに制限
- Fixed Test maxLoopCount = 8 / Exploration = 20
- TimeoutでもAction数 / Agent status / last messageをreportへ保存
- Versionをv0.1.20へ更新

### Validation

- Unit / contract tests: PASS
- Official onData `predictionParsed` shape regression: PASS
- Config migration regression: PASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #26をmainへmerge済み
- v0.1.20 main CI: PASS
- v0.1.20 Release workflow: PASS
- `game_dev_hub_0.1.20_setup.exe` / blockmap / latest.yml の生成を確認
- v0.1.20 Windows実機でWASD / Mouseの再テスト: User環境で確認待ち


---

## v0.1.21 Fixed Test Runtime Context

### User実機Evidence

v0.1.20のDeep Factory固定AI Test:

- Game起動: PASS
- WASD移動: UNKNOWN
- Mouse操作: PASS
- WASDのAgent status: `call_user`
- WASDの最終Message: Gameが未起動と誤認し、操作せずUserへ確認を返した
- 同一Run内で対象Window `Deep Factory (DEBUG)` の検出は成功済み

### Root Cause

UI-TARSへ「対象Window名」は渡していたが、「HubがこのRunでWindowを実際に検出・Focus済み」というRuntime Evidenceを明示していなかった。固定Smoke TestでもModelが起動状態を画面から再推論し、誤って `call_user()` を選べた。

### 修正

- 実際に検出したWindow titleを `runUiTarsTest` へ渡す
- Promptへ「検出・Focus済み / Game起動済み」を明示
- WASD Smoke Testの第一ActionをW短押しへ具体化
- Fixed Testでは `call_user()` を使わないよう明示
- 操作不能時は `finished(...UNKNOWN...)` へ収束
- Fixed Testで `call_user` が返った場合の専用Diagnostic reasonを追加
- Prompt Regression Testを追加
- Versionをv0.1.21へ更新

### Validation

- PR #27 CI: PASS
- Unit / contract tests: PASS
- Production runtime dependency verification: PASS
- Windows installer build: PASS
- Updater artifact verification: PASS
- PR #27をmainへsquash merge済み（`b02b07715d0a9fbe59a799e053dfb049c6fa9493`）
- v0.1.21 Release workflow: PASS
- `game_dev_hub_0.1.21_setup.exe` / blockmap / latest.yml の公開を確認
- v0.1.21 Windows実機WASD再テスト: User環境で確認待ち


---

## v0.1.22 UI-TARS model request timeout fix

### User実機Evidence

v0.1.21 / Deep Factory fixed AI Test:

- App version: 0.1.21
- Game launch: PASS
- WASD: UNKNOWN
- Mouse: UNKNOWN
- WASD agent: `status=error / turns=0 / actions=0 / Request timed out.`
- Mouse agent: `status=error / turns=0 / actions=0 / Request timed out.`
- WASD / Mouseとも開始から約37秒で終了
- Hub設定のFixed Test timeoutは120秒

### Root Cause

`@ui-tars/sdk@1.2.3` のModel実装は、OpenAI互換の各Chat Completion Requestに30秒timeoutをhard-codeしている。Hubの120秒Test timeoutへ到達する前に初回Vision inferenceが停止していた。

### 修正

- UI-TARS Model configへHub管理のCustom fetchを接続
- SDK内部の短いRequest AbortSignalをHubのeffective AbortSignalへ置換
- Hub側120秒Test timeout / User stop / Emergency stopは維持
- Model provider errorをUNKNOWN Resultのreasonへ直接保存
- Runtime transport cancellation boundaryのRegression Testを追加
- Requirements / Project Rules / Project Learningsを更新
- Versionをv0.1.22へ更新

### Validation

- PR #28 CI: PASS
- Unit / contract tests: PASS
- Production runtime dependency verification: PASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #28をmainへsquash merge済み（`91e4f6586b1841e3657e2ae148e6d4fe7156c1d5`）
- v0.1.22 main CI: PASS
- v0.1.22 Release workflow: PASS
- `game_dev_hub_0.1.22_setup.exe` / blockmap / latest.yml の公開を確認
- Windows実機WASD / Mouse Computer Use: v0.1.22でUser環境確認待ち


---

## v0.1.23 AI test evidence reliability

### User実機Evidence

v0.1.22 / Deep Factory fixed AI Test:

- Game launch: PASS
- WASD: UI-TARS reportはPASS / low confidence
- WASD Action logで `hotkey(key=w)` が実行され、User目視では実際に移動した
- UI-TARSのWASD最終説明は「変化は見られない」としながらPASSで、Result内に自己矛盾があった
- Mouse: reportはUNKNOWN / timeout
- Mouse Action logは3回のClickまで到達し、User目視では実際に視点移動した
- 前Versionの30秒provider timeoutは再発せず、AIが複数TurnとComputer Use Actionまで進んだ

### Root Cause / Gap

- Machine-readable `status=PASS` をactual / reasonとの意味整合確認なしで採用していた
- Default Mouse Smoke TestがFPS視点確認ではなくgeneric clickになっており、Local 7Bがクリック対象探索を続けて120秒を消費した

### 修正

- 明確な否定Evidenceを含むPASSをUNKNOWNへ補正
- Default Mouse Smoke TestをMouse Look確認へ変更
- 旧Default Mouse TestのみConfig v3 Migration
- User custom Test definitionは保持
- Fixed Test Promptを最大3ターンへ短縮
- Fixed Agent maxLoopCountを3へ変更
- Versionをv0.1.23へ更新

### Validation

- PR #29 CI: PASS
- Unit / contract tests: PASS
- Production runtime dependency verification: PASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #29をmainへsquash merge済み（`d11168ea73452d36a6aad7738b9068d67383c6f5`）
- v0.1.23 main CI: PASS
- v0.1.23 Release workflow: PASS
- `game_dev_hub_0.1.23_setup.exe` / blockmap / latest.yml の公開を確認
- Windows実機の新Mouse Look判定 / contradiction guard: v0.1.23でUser環境確認待ち


---

## v0.1.24 Deterministic Runtime Test Bridge

### 方針変更

User判断により、AIにゲームをプレイさせる方式を通常開発のPrimary pathから外す。

固定テスト:
- Game Dev Hubが決められたKeyboard / Mouse Inputを実Gameへ送る
- Godot Game Foundation Runtime Test Bridgeから内部Stateを取得
- Before / Afterを機械的に比較してPASS / FAIL / UNKNOWNを判定
- Screenshotは補助Evidence

AI:
- UI-TARSは「AI探索（実験）」として残す
- Agent-Sは将来候補のまま
- LM Studio / API Key / Vision inferenceは通常Fixed Testに不要

### Current Cross-Repository State

- Godot Game Foundation main `d49e5856...`: Foundation 0.9.0-dev Runtime Test Bridge実装済み
- Deep Factory main `b827bc8c...`: Player / Camera / Inventory / Money / Upgrade / Small Miner telemetry provider統合済み
- Deep Factory main `8cbeb87f...`: Runtime Test Bridge Run中のPeriodic / Event / Safe Quit Save writeを停止し、本番SaveへのTest操作混入を防止済み

### Game Dev Hub変更

- Fixed Testを `runDeterministicTestSuite` へ切替
- Test Runごとに一意なSession ID / Local `state.json` pathを生成
- Game起動へ `--foundation-test-state` / `--foundation-test-session` を追加
- schemaVersion / sessionId / sequenceを検証しstale snapshotを拒否
- WASDはW 350ms入力後のPlayer position差分で判定
- Mouseは右方向の小さなMove後のyaw / pitch差分で判定
- Target Game Window以外がActiveならInput停止
- Report engineを `Runtime Test Bridge` とし、Screenshot roleをsupplemental evidenceとして記録
- Fixed / Failed RetestはAIなし、AI Explorationだけ既存UI-TARS経路を使用
- UIを「ゲーム自動テスト / 固定テスト開始 / AI探索（実験）」へ整理
- Config v4へMigration
- Versionをv0.1.24へ更新

### Validation

- PR #31 CI: PASS
- Unit / contract tests: PASS
- Runtime Test Bridge verdict / session / migration regression: PASS
- Production runtime dependency verification: PASS
- Windows installer build: PASS
- updater artifact verification: PASS
- PR #31をmainへsquash merge済み（`f17d3c5a23371d65002ebc80e70b3b8a44b94569`）
- v0.1.24 main CI: PASS
- v0.1.24 Release workflow: PASS
- `game_dev_hub_0.1.24_setup.exe` / blockmap / latest.yml の公開を確認
- Foundation Runtime Test Bridge単体CI: Foundation mainで実装済み
- Deep Factory Runtime telemetry integration / Test Save isolation: Deep Factory mainで実装済み
- Windows実機 Fixed Test E2E: PASS。Deep Factory commit `8cbeb87f` / Game Dev Hub v0.1.24でGame起動・WASD・Mouseの3/3をRuntime Test Bridgeからhigh confidenceで確認
- Runtime Test Bridge session照合: `sessionMatched=true`、WASDはPlayer position 2.323m変化、Mouseはyaw 0.6875 rad変化を確認
- Windows実画面の最終Visual確認: 添付ScreenshotでPrimary画面に重大な崩れは見当たらないが、Visual Quality full reviewは未実施


---

## v0.1.25 Foundation Source Status Clarification

### User Evidence

Game Dev Hub v0.1.24で `EliteMay/godot-game-foundation` を選択した画面に「Game Foundation: 未導入 / 既存Gameです」と表示され、Foundation本体とConsumer Gameの区別がつかなかった。

### Root Cause

RendererのFoundation status表示が `.game-foundation.json` のinstalled stateだけを見ており、Foundation Source Repository自体を特別扱いしていなかった。

### 修正

- `EliteMay/godot-game-foundation` をFoundation Source Repositoryとして識別
- Sourceでは「Foundation本体」と表示
- 「Game Foundationの導入対象ではありません」と説明
- SourceではFoundation更新Buttonを隠す
- 通常の未導入Game向けCopyもPhase番号依存から一般説明へ修正
- UI Contract Testを追加
- Versionをv0.1.25へ更新

### 未確認

- v0.1.25のWindows実画面でFoundation本体表示を最終確認

---

## v0.1.26 Foundation Starter Profile Selection

### 目的

Godot Game Foundation Phase 17で追加したStarter Profile ContractをGame Dev Hubへ接続し、新規Game作成時に既存互換の最小構成とGame-readyな標準構成を安全に選べるようにする。

### Cross-Repository Foundation

- Godot Game Foundation PR #33
- Foundation main commit: `445f5e86d3940210dfeb6c82dee1f93442097f0d`
- `minimal` / `standard` の両StarterをFoundation CIでmaterialize / import / Main Scene / Integration Smoke済み
- Foundation Windows Build PASS

### 実装

- `foundation-template.mjs`
  - Manifest Profile validation
  - Manifest未対応旧形式のimplicit `minimal` fallback
  - Profile Catalogの安全なRenderer向けProjection
  - User選択Profileのfail-closed解決
  - Profile固有 `starterFiles` materialization
  - Installation Metadataへ `starterProfile`
  - 旧Metadataの `minimal` compatibility
  - Foundation Update時のProfile保持
- Main / Preload
  - Foundation最新版からProfile一覧を取得する専用IPC
  - Create requestへ選択Profile IDを追加
  - RendererへFilesystem / Shell等の汎用Capabilityは追加しない
- Renderer
  - 新規Game Dialogへ「開始構成」を追加
  - ManifestでselectableなProfileだけ表示
  - Foundation取得中は作成Buttonを無効化
  - Profile説明を選択に追従
  - Profile取得失敗時は作成を停止して理由を表示
  - Foundation導入状態へProfile IDを表示
- Version
  - Game Dev Hub `0.1.26`

### Compatibility / Safety

- Existing root `starterFiles` は `minimal` として互換維持
- 旧 `.game-foundation.json` にProfileが無い場合は `minimal`
- Foundation更新対象は引き続き `addons/game_foundation` のみ
- Starter作成は既存どおりFileのない空Repository限定
- Profile固有Scene / Scriptは初回生成だけで、Foundation更新時に上書きしない

### Validation

- Foundation Profile Unit / Regression Testを追加
- UI Contract TestへProfile selector / IPC / payloadを追加
- PR #39 初回CI: 110/111 PASS
  - Updater Contractだけが旧Version `0.1.25` 固定のままでFAIL
  - `0.1.26`へ同期して修正
- PR #39 修正後 Node Test: 111/111 PASS
- Production runtime dependency verification: PASS
- Windows installer build: PASS
- Updater artifact verification: PASS
- Installer artifact upload: PASS
- Dependency Review: PASS（Dependency graph unavailable時はlatest shared security baselineにより安全にskip）
- CodeQL: PASS
- Windows実機でのminimal / standard新規生成・起動はRelease後のUser確認対象

---

## v0.1.27 — ローカル試作モード

### User Problem

Foundationの `minimal / standard` を実機確認するたびに空GitHub Repositoryを作る必要があり、検証用Repositoryが増えて管理が面倒だった。

### 方針

新規Foundation Gameを次の2 Flowへ分離する。

1. **ローカル試作（Default）**
   - Repository URL不要
   - PC内にGodot Project + Local Git履歴を作成
   - `minimal / standard` 選択可能
   - Godot / Game起動・Folder表示・Local Commitを利用
2. **GitHubで正式管理**
   - 直接空Repositoryへ生成する既存Flow
   - またはLocal Prototypeを後から空RepositoryへPushして昇格

### 実装

- Project Registry schemaをv2へ更新
  - `sourceType: github | local-prototype`
  - 旧Recordは `github` として互換Migration
- Local PrototypeはremoteなしのLocal Git Repositoryとして作成
- Foundation Starterを選択Profileでmaterializeし、初回Local Commitを作成
- Local Repository inspectionはoriginを要求しない
- 「ローカル履歴に保存」はSecret guardを維持しつつLocal Commitだけ行う
- Foundation UpdateはLocal Prototypeでも利用できるがFoundation Source取得のためNetworkは必要
- GitHub同期ActionはLocal Prototypeでは表示しない
- GitHub ActionをLocal Prototypeでは「GitHubで正式管理」に切替
- Empty RemoteへPush成功後、同じFolder / Project IDのままGitHub管理へRegistryを切替
- Remoteに既存履歴がある場合はfail-closed
- Rendererへraw Git / Filesystem capabilityは追加せずoperation-specific IPCを維持

### Regression Guard

- 旧Registry v1 → GitHub sourceType migration
- Local Prototype record / explicit ID preservation
- originなしLocal Repositoryがvalid
- Local saveがoriginなしでCommitできる
- Create DialogがLocal PrototypeをDefaultにする
- GitHub URL requiredはGitHub modeの時だけRendererで切替
- Publish IPC / DialogのContract

### Version

- Game Dev Hub `0.1.27`

### Validation

- PR CIでNode Test / production dependency / Windows installer / updater artifactsを確認する
- Security workflowでCodeQLを確認する
- Release後、Windows実機でLocal `minimal` をRepositoryなしで生成・起動する
- Local Prototype → GitHub正式管理の実機Pushは別確認項目として残す

