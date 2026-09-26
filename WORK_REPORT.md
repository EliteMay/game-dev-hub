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

- Unit / contract tests: CIで確認
- Windows installer build: CIで確認
- updater artifact verification: CIで確認
- v0.1.19実機でUI-TARS診断がOKになること: Release後にUser Windows環境で再確認
