# Game Dev Hub Requirements

## 目的

Game Dev Hubは、複数のゲーム開発Projectを1つのWindowsアプリから管理し、GitHub Desktop・PowerShell・Godot Project Managerを毎回行き来する負担を減らす。

## Source of Truth

- Game Dev Hub自体の仕様・実装 → `EliteMay/game-dev-hub`
- 各ゲーム固有の仕様・コード・データ → 各ゲーム自身のGitHub Repository
- 共通Web / Electron制作ルール → `EliteMay/web-project-guide`

Hub側へ各ゲームの詳細仕様を複製しない。

## Primary Task

1. Game Dev Hubを開く
2. 開発するゲームを選ぶ
3. **開発を開始**を押す
4. Repositoryを安全に最新化する
5. 正しいGodot Projectを開く

## v0.1

### 必須

- 複数ゲームを一覧表示できる
- Deep Factoryを初期登録できる
- Gitが利用可能か確認できる
- ゲームごとのRepository状態を確認できる
- Repositoryが無ければCloneできる
- clean worktree + expected branchの場合だけfast-forward更新できる
- Godotを自動検出できる
- Godot.exeを手動選択できる
- Godot Editorをゲームごとに起動できる
- ゲームを直接起動できる
- Repositoryフォルダを開ける
- GitHub Repositoryを開ける
- GitHub URLからゲームを追加できる
- PC上の既存Godot Repositoryを登録できる
- 登録ゲームをHubから外せる
- 操作ログを表示する
- 設定・Project一覧をElectron `userData`へ保存する

### Electron Desktop Foundation

- Global SettingsはSchema Versionを持ち、破損時はLast-known-good backupから復旧できる
- App固有設定 / RegistryはChromium管理領域と衝突しない `userData/hub-data` 配下を正本とする
- v0.1.2以前のroot直下Dataは削除せず、新保存先へCopy Migrationする
- Window Size / Position / Maximizedを保存し、Display変更後は到達可能なWork Area内へ戻す
- 2重起動を防ぎ、2回目の起動では既存WindowをRestore / Focusする
- 最後に選択したGameを復元する
- 起動 / Update /主要IPC / Renderer failureをboundedなLocal Logへ記録する
- 診断画面からApp / Electron / OS / Update / Network / Storage /直近Errorを確認できる
- Diagnostic ExportはGame名、Repository URL、Secret、File本文を含めず、Home PathをRedactする
- Rendererが異常終了した場合は無限自動Restartせず、UserがReload / Exitを選べる
- Offline時はGitHub同期を停止し、利用可能なLocal操作を明示する
- Dark / Night mode要件に合わせElectron Native ThemeもDarkへ固定する
- Windows AppUserModelID / Runtime identityをInstaller identityと一致させる
- 長い処理で実測不能なPercent / ETAを捏造せず、少なくとも現在の処理名を表示する

### 自動アップデート

- Stable Update Providerは `EliteMay/game-dev-hub` のGitHub Releasesに固定する
- App起動後のUpdate確認はバックグラウンドで行いPrimary TaskをBlockしない
- Userの明示操作なしに突然再起動しない
- 新Version検出後、Download進捗を表示できる
- Download完了後「再起動して更新」で適用できる
- Pre-releaseはStable利用者へ配布しない
- Update失敗時もCurrent Versionを継続利用でき、GitHub Releaseへの手動Fallbackを提供する
- Release Assetは同一BuildのSetup.exe / blockmap / latest.ymlを揃える
- v0.1.2をUpdater Bootstrap Versionとし、それ以前からは1回だけ手動Installer更新を必要とする
- userDataに保存したProject一覧・Godot pathはApp Updateで削除しない
- Code signing未導入中は署名済みと表示・記録しない

### 非目標

- ゲーム本体をHub Repositoryへ集約する
- HubからGit commit / push / force operationを行う
- Hubから任意PowerShell / Terminal commandを実行する
- GitHub Tokenを保存する
- Godot自体をHubから自動インストールする
- 各ゲームの仕様書をHubへコピーする

## Repository同期Contract

自動同期を許可する条件:

- Gitが利用可能
- `.git`が存在
- `project.godot`が存在
- originが登録済みGitHub Repositoryと一致
- current branchがProjectのdefault branchと一致
- working treeがclean

許可Operation:

```text
git fetch --prune origin
git pull --ff-only origin <defaultBranch>
```

禁止Operation:

- reset
- clean
- force
- rebase
- auto commit
- auto push
- working tree破棄

## UI

- Dark / Night modeを基本とする
- ゲーム一覧と選択中ゲームの状態を1画面で理解できる
- 英語だけの専門用語表示を避ける
- Status colorだけに意味を依存しない
- Primary Actionは「開発を開始」
- エラー時は「何が起きたか」と「次に何をするか」を表示する

## 保存

保存対象:

- 登録ゲーム
- Repository URL
- Local Repository Path
- Default branch
- Engine type
- Default Godot executable path
- Last selected Game
- Window Size / Position / Maximized state

Secretは保存しない。

## 完成条件

v0.1は、Windows実機で次を確認して初めて完成扱いとする。

1. App起動
2. Deep Factory表示
3. Repository clone / sync
4. Godot検出または選択
5. Godot Editor起動
6. Game直接起動
7. 2つ目のGame登録
8. App再起動後もProject一覧復元
9. dirty worktreeで同期安全停止
10. Setup.exe install / uninstall
11. v0.1.2から次Stable Versionを検出
12. Update download / restart install
13. Update後もProject一覧・Godot pathを維持
14. Update失敗時にCurrent Versionを継続利用し手動Fallbackへ進める
15. v0.1.2の設定 / Project一覧がv0.1.3の `hub-data` へ維持される
16. Window位置 / Size / Maximizedが再起動後に復元される
17. Display構成変更後もWindowが画面外へ消えない
18. 2重起動時に2個目のMain Windowを作らず既存Windowへ戻る
19. OfflineでもGodotで開く / Game起動 / Folder表示が利用できる
20. Renderer異常終了時に保存Dataを消さずRecovery導線へ進める
21. 診断JSONがSecret / Repository URL / File本文を含まない
