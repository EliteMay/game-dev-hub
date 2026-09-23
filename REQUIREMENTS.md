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

## v0.2 — Game Dev Hub自体の更新

### 必須

- GitHub Releasesのstable Releaseを更新元にする
- 起動を長時間止めずバックグラウンドで更新確認する
- 手動の「更新を確認」を提供する
- 新Versionがある場合だけ明示操作でダウンロードする
- ダウンロード進捗を表示する
- 更新準備完了後も自動再起動せず「再起動して更新」を要求する
- Update error時も現在Versionを継続利用できる
- Update error時はGitHub Releaseの手動導線を提供する
- Rendererへ任意Update URLやNode APIを公開しない
- Release tag / package version / Setup.exe / latest.ymlを同じRelease Pipelineで整合させる
- v0.2.0をUpdater Bootstrap Versionとし、v0.1.1以前からは1回だけ手動Installer更新を必要とすることを明記する
- Project Registry / Settings等の`userData`を更新で消さない

### Release Contract

Stable Release:

```text
vX.Y.Z
├─ game_dev_hub_X.Y.Z_setup.exe
├─ game_dev_hub_X.Y.Z_setup.exe.blockmap
└─ latest.yml
```

Release PipelineはVersion tagと`package.json#version`不一致時に停止する。

### Security

- Update providerは`EliteMay/game-dev-hub` GitHub Releasesへ固定する
- Pre-releaseをstable auto updateへ混ぜない
- Rendererからfeed URLを変更できない
- Download / Installは`electron-updater`のmetadata integrity検証経路を使う
- Windows code signingは未導入。署名済みと扱わず、導入までSmartScreen等の制約を未解決事項として扱う

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

v0.2のUpdate機能は追加で次を確認する。

11. v0.2.0 InstallerにUpdaterとGitHub provider metadataが含まれる
12. ReleaseにSetup.exe / blockmap / latest.ymlが揃う
13. v0.2.0インストール後に次stable Versionを検出できる
14. Download progressが表示される
15. 「再起動して更新」まで勝手に再起動しない
16. Update後もProject一覧 / Godot pathが維持される
17. Update失敗時も現Versionを起動・利用できる
