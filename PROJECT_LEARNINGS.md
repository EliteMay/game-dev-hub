# Project Learnings

このFileは、Game Dev Hubで今後も再利用する価値がある失敗・成功・予防策だけを残す。

## GL-001 — ゲーム本体と開発Hubを同じRepositoryへ混ぜない

- Date: 2026-09-23
- Type: Architecture
- Status: Adopted
- Problem: Deep Factory専用LauncherをGame Repository内へ置くと、将来Gameが増えるたびに同じToolを複製するか、1つのGame Repositoryへ他Gameの管理責務が混ざる。
- Decision: Game Dev Hubを独立Repositoryにし、各Gameは独立RepositoryをSource of Truthとして維持する。
- Boundary: HubはProject metadataと開発操作だけを管理し、Game固有の仕様・Assets・Codeは持たない。
- Prevention: 新しい共通開発機能は、特定Game固有か複数Game共通かを先に分類する。

## GL-002 — Repository同期は安全条件を満たす時だけ自動化する

- Date: 2026-09-23
- Type: Safety / UX
- Status: Adopted
- Decision: clean worktree + expected branch + expected originを確認し、fetch + pull --ff-onlyだけを許可する。
- Reason: 初心者向けに操作を減らしても、ローカル変更を勝手に破棄する自動化は許可しない。

## GL-003 — 必須入力を持つdialogのCancelをsubmitにしない

- Date: 2026-09-23
- Type: UI / Regression
- Status: Adopted
- Problem: `method="dialog"` のform内でCancelをsubmit buttonのままにすると、required inputのconstraint validationが先に動き、× / キャンセルを押しても閉じない。
- Decision: Cancel / close controlは `type="button"` と明示的な `dialog.close()` を使い、確定操作だけをsubmitにする。
- Prevention: 主要button無反応はRegression Testを追加し、必須入力が空の状態でもCancelできるContractを維持する。

## GL-004 — Updater導入VersionをBootstrapとして明示する

- Date: 2026-09-24
- Type: Distribution / Update
- Status: Adopted
- Problem: Updaterを持たない旧Versionへ、後からRemote UpdateだけでUpdater機能を追加することはできない。
- Decision: v0.1.2を最初のUpdater搭載Versionとし、v0.1.1以前からの移行だけは手動Installerを必要とする。以後はStable GitHub ReleaseのSetup.exe / blockmap / latest.ymlを同一Pipelineで公開する。
- Prevention: Version / Release tag / updater metadataを一致させ、CIでlatest.ymlとblockmapの生成を検証する。

## GL-005 — Electron共通責務をFeatureごとに散らさない

- Date: 2026-09-24
- Type: Electron / Reliability
- Status: Adopted
- Problem: Window状態、診断、Update、設定Recovery、Network状態を個別Featureへ足すと、保存先・Error処理・UI stateが重複しやすい。
- Decision: Game Dev HubではDesktop Foundationとして `userData/hub-data`、Settings Schema、bounded Log、Diagnostics、Window State、Single Instance、Renderer Recoveryを共通責務へ集約する。
- Compatibility: v0.1.2以前のroot直下Dataは削除せずCopy Migrationし、Rollback可能性を残す。
- Prevention: 新しいDesktop機能はProduct固有Logicか共通Foundationかを先に分類し、同じ状態の第二Source of Truthを作らない。

## GL-006 — OfflineとProvider failureでLocal機能を巻き込まない

- Date: 2026-09-24
- Type: Reliability / UX
- Status: Adopted
- Problem: GitHub接続失敗をApp全体の失敗として扱うと、Godot起動やFolder表示などNetwork不要の機能まで使えないように見える。
- Decision: `net.isOnline()` がfalseの時はGitHub同期 / Updateを停止し、Local操作は利用可能と明示する。online=trueはGitHub到達成功の保証には使わない。
- Prevention: External Provider failureとLocal Capability stateを分けて表示・診断する。

## GL-007 — 開発Taskの正本をHubへ複製しない

- Date: 2026-09-24
- Type: Architecture / Workflow
- Status: Adopted
- Problem: Hub独自TODOとGame RepositoryのRoadmapを両方編集できると、どちらがCurrentか分からなくなる。
- Decision: Task completionはGame RepositoryのRoadmap/TODOを正本とし、HubはRead-only表示とActive Task選択だけを担当する。
- Refresh: Repository sync後のLocal fileを毎回読み直す。
- Prevention: Hubへ独立したTask completion DBや自動Roadmap書換え機能を追加しない。

## GL-008 — ChatGPTへの開発Handoffは明示Exportにする

- Date: 2026-09-24
- Type: AI Handoff / Privacy
- Status: Adopted
- Problem: 自動で大量のFile/画像/Pathを収集すると不要な個人DataやSecretを共有しやすい。
- Decision: Userが「ChatGPT共有パックを作る」を押した時だけ、Sanitized JSON・Hub Screenshot・明示追加した参考画像を固定Folderへ生成する。
- Boundary: Token / Secret / Source File本文はExportしない。CodeはCurrent GitHub RepositoryをSource of TruthとしてChatGPT側で確認する。
