# Game Dev Hub

## v0.1.9 実機確認結果の記録 / Task Flow改善

「担当: あなた」の実機確認Taskを、手順を見るだけで終わらずHub内で結果まで返せるようにしました。

- 確認手順ごとに「できた / できなかった / 今は確認できない」を選択
- 確認結果と任意メモをApp Dataへ自動保存
- 確認時のRepository commit / branch / Godot Version / Hub VersionをEvidenceとして保存
- Roadmap手順が変わった場合は以前の確認結果をstaleとして再確認を要求
- Taskカード内から直接「ゲームを起動」
- 確認用スクショを同じ場所から参考画像へ追加
- ChatGPT共有パックへ選択結果・メモ・確認Versionを同梱
- User確認Taskの共有Buttonを結果に応じて「できた結果を送る / できなかった結果を送る」等へ変更
- 完了済みTaskは初期状態で非表示にし、必要な時だけ展開
- 今後のPhaseも初期状態では隠し、現在Phaseへ集中できるようにする
- Checkbox TaskがあるRoadmapでは通常Bulletを進捗Taskとして数えない
- Current Phaseの進捗を優先表示し、Roadmap全体数は補助情報にする

## v0.1.8 ChatGPT共有パックの保存先 / 引き継ぎ改善

- ChatGPT共有パックをDocuments配下へ作らず、ElectronのApp Data内 `hub-data/chatgpt-packs` へ保存
- 共有パック作成後は従来どおり生成FolderをExplorerで開く
- JSONへChatGPT / Userの役割分担を明記
- Taskの担当をRoadmapから表示できるようにし、`担当: あなた` / `担当: ChatGPT` / `担当: Hub` をサポート
- 選択中TaskでGitHub上だけで完了できる作業は、ChatGPTが説明だけで止めずRepositoryへ反映するよう引き継ぎ指示を追加
- Userへ依頼するのはWindows実機操作・Godot目視・Playtest等、Userにしか確認できない内容を基本とする
- 共有情報とCurrent Repositoryで判断可能な内容は不要に聞き返さない

既にDocumentsへ作成済みの古い `ChatGPT Packs` Folderは自動削除しません。必要なければUser側で削除できます。

## v0.1.7 ローカル変更をアプリからGitHubへ保存

PC側に変更があるとき、Gitの操作を別アプリやPowerShellで覚えなくてもGame Dev Hub内で保存できるようにしました。

- 安全停止Panelへ「GitHubに保存」を追加
- 保存前に変更File一覧と説明を確認
- 変更をPCの履歴へ保存してGitHubへ送信
- GitHub側に新しい変更がある場合は、強制上書きせず通常Mergeで安全に統合
- 競合時はMergeを中断し、PC側の変更を保持
- Pushだけ失敗した場合は「GitHubへ送る」で再試行可能
- `.env` / private key等、秘密情報らしいFileを検出した場合は自動保存を停止
- `reset` / `clean` / `rebase` / force pushは使わない
- Git設定のUser名/Emailが無い場合はRepository local設定だけを補完

## v0.1.6 ローカル変更を日本語で説明

v0.1.5の安全停止画面がGitの記号や専門語を前提にしていたため、初心者でも意味と次の操作が分かる表示へ修正しました。

- `M` / `??` などのGit記号を通常画面へ出さない
- 「内容が変更」「新しく作成」など日本語の状態名を表示
- `project.godot` と `.uid` Fileには役割の説明を表示
- 「このままGodotで続ける」をPrimary Actionとして表示
- 分からない場合は安全停止Panelから直接ChatGPT確認データを作成可能
- GitHub同期の技術手順は折りたたみ、通常時は見せすぎない
- 安全停止中にTask詳細が古い可能性も案内

## v0.1.5 安全停止の解除導線 / タスク手順表示

状態を表示するだけだった箇所を、次の行動まで分かるFlowへ改善しました。

- ローカル変更があるときは「GitHub同期だけが停止中」と明示
- 変更されている相対File名を安全停止パネルへ表示
- 安全停止中も「同期せずGodotで開く」でLocal開発を継続可能
- 同期を再開するための手順と「状態を再確認」を表示
- Roadmapのタスククリックを「作業開始」ではなく「今やるタスクの選択」として表示
- 選択したタスクに「今すること」「完了の目安」を表示
- RoadmapのネストしたBulletをタスク手順として読み取る
- Roadmapに詳細がない場合は、選択中タスクを含むChatGPT共有パック作成へ案内
- ChatGPT共有JSONへ変更File一覧とGit / GodotのVersion情報を追加

Hubは引き続きローカル変更を自動で破棄・Commit・Pushしません。

## v0.1.4 開発ワークスペース

Game Dev HubをLauncherだけでなく、日常のゲーム開発作業をまとめるWorkspaceへ拡張します。

- Game Repositoryの `docs/ROADMAP.md` / `ROADMAP.md` / `TODO.md` を自動読込
- Checkboxと通常の箇条書きを「やること」として表示
- RepositoryをHubから更新すると、やること一覧もCurrent Local Repositoryへ追従
- 未完了タスクを「作業中」に選択し、次回起動後も復元
- Gameごとの参考画像をHub Local DataへCopyして一覧表示
- 参考画像はGame Repositoryへ勝手にCommitしない
- 「ChatGPT共有パックを作る」で次を `Documents/Game Dev Hub/ChatGPT Packs` へ自動生成
  - `game-dev-hub-report.json`
  - `hub-screenshot.png`
  - `reference-images/`
  - `CHATGPTに送る.txt`
- 共有JSONにはRepository状態、Roadmap、作業中タスク、直近診断情報を含める
- Token / Secret / Source File本文は共有JSONへ含めず、Home Pathは伏せる

基本Flow:

```text
Gameを選ぶ
→ Roadmapから「やること」を確認
→ 今やるタスクを選ぶ
→ 必要なら参考画像を追加
→ ChatGPT共有パックを作る
→ ChatGPTへJSON + 画像を送る
→ Godotで実装 / Playtest
→ Repository更新
→ Hubのやることも更新
```


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

## v0.1.3 Electron Desktop Foundation

最新版の `web-project-guide` Electronルールに合わせ、Desktop共通基盤を追加しました。

- 設定Schema v2
- `userData/hub-data` へのApp固有Data分離
- v0.1.2以前の `settings.json / projects.json` を残したまま新保存先へCopy Migration
- JSON破損時にatomic backupから復旧
- Window位置 / Size / 最大化状態の保存と画面内への復元
- Single Instanceで二重起動を防止し、既存WindowへFocus
- 最後に選択していたGameを復元
- boundedな永続診断Log
- 「診断」画面 / Sanitized JSON Export / Log folder表示 / Log消去
- Renderer停止時の明示的な再読み込み / 終了Recovery
- Offline状態をGitHub同期とLocal操作で分離
- Native Dark ThemeとWindows App identityを固定
- 実測できない進捗率や残り時間は表示せず、現在の処理名だけ表示

Secret Storage、Download Manager、Process Supervisor、Power lifecycleは現在のHub要件では不要なため追加していません。必要なFeatureが入った時点で再評価します。

## v0.1.2 自動アップデート

- 起動後にGitHub ReleasesのStable版をバックグラウンド確認
- 「更新を確認」から手動確認
- 新Versionがあればアプリ内でダウンロード
- ダウンロード進捗を表示
- 完了後「再起動して更新」で適用
- 自動更新失敗時はGitHub Releaseを開く手動Fallback
- Update Providerは `EliteMay/game-dev-hub` のGitHub Releasesに固定
- Pre-releaseは自動更新対象外

**v0.1.2が最初のUpdater搭載Versionです。** v0.1.1以前にはUpdaterが無いため、v0.1.2への移行だけはSetup.exeを手動インストールする必要があります。以後のStable Releaseはアプリ内から更新できます。

Releaseには同じBuildから生成した `Setup.exe`、`.blockmap`、`latest.yml` を一緒に公開します。

> 現在Windows code signingは未導入です。Updater metadataのSHA-512整合確認は利用しますが、署名済みアプリとは扱いません。

## v0.1機能

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
- 永続診断Log / 診断JSON Export
- Window state / last selected Gameの復元

## 安全なGit更新

自動同期では、登録Repository・Branch・working treeを確認してから、

```text
git fetch --prune origin
git pull --ff-only origin <defaultBranch>
```

だけを実行します。

Local変更がある場合は自動更新を止め、Userが「GitHubに保存」を明示的に押した場合だけ保存Flowへ進みます。

保存Flowでは `add -A` → `commit` → 必要なら通常`merge` → `push` を使います。競合時はMergeをabortし、PC側のCommitを残します。

Hubから `reset` / `clean` / `rebase` / force push は行いません。

## 開発環境

- Electron
- Node.js 20+
- Windows target
- Git / GitHub
- Godot project launcher
- electron-builder / NSIS
- electron-updater / GitHub Releases

## 開発起動

```powershell
npm install
npm test
npm run dev
```

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
- v0.1.2 → v0.1.3の実機Auto Update: 未確認
- Window state / Single Instance / Renderer RecoveryのWindows実機確認: 未確認

Windows固有部分は実機確認が終わるまで完成扱いにしません。

## Documentation

- `REQUIREMENTS.md` — 現在のProduct要件
- `PROJECT_RULES.md` — Game Repositoryとの責務分離
- `PROJECT_LEARNINGS.md` — 再利用する学び
- `docs/ARCHITECTURE.md` — Architecture
- `docs/UX_RESEARCH.md` — UI / Flowの参考と方向

## License

`LICENSE` を参照してください。
