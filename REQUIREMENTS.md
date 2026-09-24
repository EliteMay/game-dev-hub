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

### 開発ワークスペース

- 選択中GameのLocal Repositoryから開発Roadmap/TODOを読み取れる
- Task Sourceの優先順位は `docs/ROADMAP.md` → `ROADMAP.md` → `docs/TODO.md` → `TODO.md`
- Roadmap/TODOをHubへ複製保存せず、Game RepositoryをTask状態のSource of Truthとする
- Markdown Checkboxは完了状態を保持して表示する
- Roadmapの通常Bulletも未完了Taskとして扱える
- HubからRepository同期後、Task一覧は更新済みLocal Repositoryから再読込する
- 未完了Taskを「今やるタスク」として選択でき、Gameごとの選択をSettingsへ保存する
- タスク選択は実作業開始や完了を意味しないことをUIで明示する
- 選択中TaskへRepository側Roadmapのネストした手順とPhase完了条件を表示できる
- RoadmapのTaskへ `担当: あなた` / `担当: ChatGPT` / `担当: Hub` をネストして書いた場合、Hubが担当を別情報として読み取り画面へ表示する
- Roadmapに詳細手順がない場合は、選択中Taskを含めたChatGPT共有パック作成へ案内する
- HubからRoadmapの完了状態を勝手に書き換えない
- GameごとにPNG/JPEG/WebPの参考画像をLocal管理できる
- 参考画像はHub DataへCopyし、Game Repositoryや元Fileを勝手に変更しない
- ChatGPT共有パックは固定保存先へ1操作で生成し、毎回保存Folderを選ばせない
- ChatGPT共有パックの固定保存先はDocuments等のUser文書領域ではなく、App固有Data配下 `hub-data/chatgpt-packs` とする
- 共有パック生成後は対象FolderをExplorerで開き、添付しやすくする
- 共有パックは状態JSON、Hub Screenshot、参考画像、簡易説明Fileを含む
- 共有パックは選択中Taskの引き継ぎ目的を明記し、GitHub上だけで完了できる作業はChatGPTが直接Repositoryへ反映するよう指示する
- Windows実機操作 / Godot目視 / Playtest等、Userにしか確認できない作業だけをUser actionとして分離する
- `担当: あなた` のTaskでは各確認手順へ「できた / できなかった / 今は確認できない」を選択できる
- User確認結果はGame Repositoryへ直接書き込まず、App DataのTask verification stateへ保存する
- User確認結果はTask IDだけでなく手順Signatureと結び付け、Roadmap手順変更時はstaleとして再確認させる
- User確認結果には確認時点のRepository commit / branch / Godot Version / App Version / timestampを保持する
- User確認TaskにはTask Card内からGame起動とScreenshot追加のActionを出す
- ChatGPT共有パックへ選択中TaskのUser確認結果とメモを含める
- 完了済みTaskは初期状態で折りたたみ、必要時だけ表示できる
- Current Phase以降のFuture Taskは初期状態で折りたたみ、必要時だけ表示できる
- Checkbox Taskが1件以上あるRoadmapではTop-level通常Bulletを進捗Taskに数えない。Checkboxが一切ないLegacy Roadmapだけplain bullet fallbackを許可する
- 共有JSONはRepository slug/commit/branch/dirty状態、Roadmap、作業中Task、直近Error/Logを含める
- 共有JSONはCredential/Token/Secret/Source File本文を含めず、Home PathをRedactする
- JSONだけでActual Playtest済みと断定せず、画像/User報告/実機Evidenceと分離する

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
- Userの明示操作なしにGit commit / pushを行う
- force push / reset / clean / rebase等の履歴破壊Operationを行う
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

Local変更保存Contract:

- Userが「GitHubに保存」を明示的に押した場合だけ実行する
- registered origin / expected branch / current worktreeをMain Processで再検証する
- 秘密情報らしいFile名を検出した場合はstage前に停止する
- 保存対象はCurrent worktree全体とし、確認Dialogで変更一覧を見せる
- `git add -A` で変更をstageする
- `git commit -m <message>` でPC側へ保存する
- Remoteが進んでいる場合は `git merge --no-edit origin/<defaultBranch>` で通常Mergeする
- Merge conflict時は `git merge --abort` し、作成済みLocal Commitは残す
- `git push origin HEAD:<defaultBranch>` でGitHubへ送る
- Push失敗後もLocal Commitを保持し、再試行可能な状態を表示する
- Git user.name / user.emailが無い場合はRepository local configだけを補完する
- Git CredentialはHubへ保存せず、既存Git Credential Manager等へ委譲する

禁止Operation:

- reset
- clean
- force push
- rebase
- User操作なしのcommit / push
- working tree破棄

## UI

- Dark / Night modeを基本とする
- ゲーム一覧と選択中ゲームの状態を1画面で理解できる
- 英語だけの専門用語表示を避ける
- Status colorだけに意味を依存しない
- Primary Actionは「開発を開始」
- エラー時は「何が起きたか」と「次に何をするか」を表示する
- dirty worktreeでは「GitHubへの保存待ち」と明示し、Local Godot作業は継続可能にする
- dirty worktreeでは変更File名と意味を示し、「GitHubに保存」をPrimary recovery actionとして表示する
- 保存前に確認Dialogを出し、何がGitHubへ送られるか分かるようにする
- Pushだけ失敗したLocal Commitは「GitHubへの送信待ち」として再試行導線を表示する
- Hubから変更破棄・force操作は行わない

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
- GameごとのActive development task
- GameごとのUser manual verification result

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
22. Deep FactoryのRoadmapがHubへ表示される
23. Repository更新後にRoadmap変更がHubへ反映される
24. 作業中TaskがApp再起動後も復元される
25. 参考画像を追加・表示・開く・Hubから外せる
26. ChatGPT共有パックへJSON / Hub Screenshot / 参考画像が生成される
27. ChatGPT共有JSONへToken / Secret / Source File本文が入らない
28. dirty worktreeから「GitHubに保存」でLocal Commit + Pushまで完了できる
29. Remoteが先行している場合も通常Mergeで安全に統合してPushできる
30. Merge conflict時にPC側の変更を失わず停止できる
31. Push失敗後にLocal Commitを保持し、アプリから再送信できる
32. 秘密情報らしいFileを含む場合にGitHub保存をstage前に停止できる
33. ChatGPT共有パックがDocumentsではなくApp Data配下へ生成される
34. 共有パックにChatGPT側で実行すべきRepository作業とUserだけが行える実機確認の役割分担が含まれる
35. User担当Taskで各確認Stepへ結果を選択・永続保存できる
36. User確認結果がChatGPT共有パックへ含まれ、確認Commit/Versionも追跡できる
37. Roadmap手順変更後に古いUser確認結果をそのまま有効扱いしない
38. Checkbox Roadmapの説明BulletがTask進捗へ混入しない
39. 完了済みTaskを折りたたんだ状態でも現在の未完了Taskへ到達できる
40. Future Phaseを折りたたんだ状態でもCurrent PhaseのTaskへ集中でき、必要時にFuture Taskを展開できる
