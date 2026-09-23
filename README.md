# Game Dev Hub

**Game Dev Hub** は、Godotを中心とした複数のゲーム開発Repositoryを、1つのWindowsアプリから管理するための個人用開発Hubです。

ゲーム本体を1つの巨大Repositoryへまとめず、**ゲームごとに独立したGitHub RepositoryをSource of Truthとして管理**します。

## 目的

普段の開発開始を、

```text
Game Dev Hubを開く
↓
ゲームを選ぶ
↓
「開発を開始」
```

まで短くすることを目標にしています。

Game Dev Hub側がRepositoryの安全確認、GitHubからの最新版取得、Godot起動をまとめて扱います。

## 初期登録Game

- Deep Factory — `EliteMay/deep-factory`

初回起動時にDeep Factoryを自動登録します。

## 主な機能

- 複数Gameの一覧
- GameごとのRepository状態表示
- Git / Godot状態表示
- Repositoryが無い場合のClone
- GitHubからの安全なfast-forward更新
- Godot Editor起動
- Game直接起動
- Repository Folder表示
- GitHub表示
- GitHub URLからGame追加
- 既存Local Godot Repositoryの登録
- Game登録解除（PC上のFileは削除しない）
- Project一覧 / Godot pathの保存
- 操作Log
- 起動後のバックグラウンド更新確認
- アプリ内の手動更新確認
- 更新ダウンロード進捗表示
- 明示操作による再起動・更新
- 更新失敗時のGitHub Release手動導線

## 安全なGit更新

自動同期では、登録Repository・Branch・working treeを確認してから、

```text
git fetch --prune origin
git pull --ff-only origin <defaultBranch>
```

だけを実行します。

Local変更がある場合や、別Branchの場合は勝手に解決せず停止します。

Hubから `reset` / `clean` / `rebase` / `commit` / `push` / `force` は行いません。

## 開発環境

- Electron
- Node.js 20+
- Windows target
- Git / GitHub
- Godot project launcher
- electron-builder / NSIS

## 開発起動

```powershell
npm install
npm test
npm run dev
```

## 自動アップデート

v0.2.0からGitHub Releasesを更新元にしたアプリ内更新へ対応します。

```text
アプリ起動
↓
バックグラウンドで更新確認
↓
新Versionあり
↓
「ダウンロード」
↓
「再起動して更新」
```

更新Fileのダウンロードと再起動はユーザー操作で行い、作業中に勝手に再起動しません。

**v0.2.0は最初の自動更新対応版です。v0.1.1以前からv0.2.0への移行だけはSetup.exeを1回手動インストールする必要があります。v0.2.0以降はGitHub Releaseから更新を検出できます。**

更新が失敗した場合はアプリ内の「Releaseを開く」から最新版を手動取得できます。

## Release

Version tag `vX.Y.Z` をpushすると、GitHub ActionsがWindows版をTest・Buildし、GitHub Releaseへ次を同一Buildから公開します。

- Setup.exe
- Setup.exe.blockmap
- latest.yml

`package.json#version` とtagが一致しない場合はReleaseを停止します。

## Windows build

```powershell
npm run build:win
```

`dist/` にSetup.exeを生成します。

## Project構成

```text
game-dev-hub/
├─ src/
│  ├─ main.mjs
│  ├─ preload.cjs
│  ├─ core/
│  ├─ services/
│  └─ renderer/
├─ tests/
├─ docs/
├─ REQUIREMENTS.md
├─ PROJECT_RULES.md
└─ PROJECT_LEARNINGS.md
```

## 各Gameとの分離

Game Dev Hubに置くもの:

- Game表示名
- GitHub Repository URL
- Local Path
- Default Branch
- Engine情報
- 開発開始に必要な状態

各Game Repositoryに置くもの:

- Game Design
- Gameplay code
- Assets
- Save format
- Balance
- Roadmap
- Release

Deep Factory固有の仕様は `deep-factory` 側を正本とします。

## 現在の確認状態

- Multi-project architecture: 実装済み
- Security boundary: 実装済み
- Unit / contract tests: 追加済み
- GitHub Actions Windows test/build: ✅ Success
- Windows実機でのUI / Clone / Pull / Godot起動: 未確認
- Setup.exe実機install / uninstall: 未確認
- v0.2.0 → 次Versionの実機Auto Update: 未確認
- GitHub ActionsでInstaller / update metadata生成: CIで確認予定

Windows固有部分は実機確認が終わるまで完成扱いにしません。

## Documentation

- `REQUIREMENTS.md` — 現在のProduct要件
- `PROJECT_RULES.md` — Game Repositoryとの責務分離
- `PROJECT_LEARNINGS.md` — 再利用する学び
- `docs/ARCHITECTURE.md` — Architecture
- `docs/UX_RESEARCH.md` — UI / Flowの参考と方向

## License

`LICENSE` を参照してください。
