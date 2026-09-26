# 作業報告書

## 今回変更した内容

- Game Dev Hub v0.1.14にWindowsゲーム向けAI自動テストの第1段階を追加。
- UI-TARSをPrimary Computer Use engineとして統合。
- Game exe起動、対象Window検出、WASD / Mouse操作、Screenshot Evidence、PASS / FAIL / WARNING / UNKNOWN、履歴、FAIL再テスト、探索テスト、診断、緊急停止を追加。
- 最新AI Test JSONとEvidence Screenshotを既存ChatGPT共有Packへ統合。
- 外部AI endpoint利用時はScreenshot / test instructionの外部送信とProvider課金可能性を開始前に明示し、User確認なしでは実行しない。
- API KeyはElectron safeStorageで暗号化し、plain settings / Repository / Log / ChatGPT Packへ保存しない。

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

## 削除した内容

- なし

## Known Failure Preflight

- 実施: Yes
- 検索対象: `PROJECT_LEARNINGS.md` / current Security boundary / Electron rules / current tests
- Targeted Search: Rendererへのprivileged capability公開、Computer Use暴走、external data send、API key storage、timeout / repeat loop
- 該当Learning: GL-018 Computer UseをRendererへ直接公開しない
- 今回のPrevention: operation-specific IPC / Main Process Safe Operator / Target Window allowlist / action validation / AbortController / safeStorage / external consent
- Regression Guard: `tests/ai-testing.test.mjs` / `tests/security-contract.test.mjs` / `tests/ui-contract.test.mjs`

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
- [ ] Real Windows Game E2E

## 実ブラウザ・実機確認

- [ ] Windows上でv0.1.14をインストール
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
- Release workflow成功。
- v0.1.14 Releaseと `game_dev_hub_0.1.14_setup.exe` / blockmap / latest.yml の生成を確認。

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

1. v0.1.14をWindowsへ更新 / install。
2. 自動テストタブでLocal UI-TARS endpointを設定。
3. Test target .exe / Window titleを設定。
4. 診断を実行。
5. まずGame起動 + WASD + Mouse clickの最小Testを実機で成功させる。
6. 結果JSON / Screenshot / History / ChatGPT Packを確認。
7. そのEvidenceを基に採掘・item pickup・inventory等のGame固有Testを増やす。
