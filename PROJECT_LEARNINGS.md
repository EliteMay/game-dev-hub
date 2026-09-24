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


## GL-009 — Safety stateとTask selectionにはNext Actionが必要

- Date: 2026-09-24
- Type: UX / Workflow
- Status: Adopted
- Problem: dirtyを「安全停止」、Roadmap itemを「作業中」と表示するだけでは、Userは停止解除方法も実際に何をするTaskかも判断できない。Taskをクリックしただけで作業を開始したようにも見える。
- Decision: Safety stateは「何を止めているか」「何は続けられるか」「解除するには何をするか」を同じSurfaceへ表示する。Task clickは「今やるタスクの選択」とし、Repository由来の手順 / 完了条件を表示する。
- Boundary: HubはLocal変更を勝手に破棄・Commit・Pushしない。Task completionの正本もGame RepositoryのRoadmap/TODOのまま維持する。
- Prevention: State labelだけで完了せず、Error / Blocked / Selected stateには実行可能なNext ActionまたはRecovery pathを必ず確認する。


## GL-010 — Gitの内部状態をそのまま初心者向けUIへ出さない

- Date: 2026-09-24
- Type: UX / Copy
- Status: Adopted
- Problem: `M` / `??`、dirty、Commit等のGit用語を表示しても、Gitに詳しくないUserには次の判断材料にならない。
- Decision: Git内部状態はApp側で「内容が変更」「新しく作成」「GitHubへの保存待ち」等のUser語彙へ翻訳し、必要な技術詳細はProgressive Disclosureへ分離する。
- Prevention: Owner向け主要Flowでは、内部Status codeだけを説明なしで表示しない。File種別を安全に説明できる場合は役割も補足する。


## GL-011 — Beginner向けGitHub連携は「止める」だけでなく安全な完了経路を持つ

- Date: 2026-09-24
- Type: UX / Git Safety
- Status: Adopted
- Problem: dirty worktreeを保護して同期停止するだけでは、Gitを使わないUserに「何を残す・消す・Commitするか」を判断させることになりPrimary Taskが止まる。
- Decision: 明示確認付きの「GitHubに保存」でCurrent worktreeをLocal Commitへ保存し、通常Merge + PushまでHubが扱う。Push失敗時はLocal Commitを保持して再試行可能にする。
- Safety Boundary: reset / clean / rebase / force pushは禁止。秘密情報らしいFileはstage前に停止し、CredentialはHubへ保存しない。
- Prevention: Git内部状態を表示するだけでRecovery完了とせず、初心者が同じApp内で安全に完了できるHappy PathとFailure recoveryを持つ。


## GL-012 — AI Handoffは「次を教える」ではなく「誰が実行するか」まで渡す

- Date: 2026-09-24
- Type: AI Handoff / Workflow
- Status: Adopted
- Problem: 共有パックがRepository状態と「次の変更」を求めるだけだと、ChatGPTがRepositoryへ直接反映できるTaskでも説明だけ返し、Userへ余分な操作を戻すことがある。
- Decision: 共有パックへRole boundaryを明記する。GitHub上だけで完了する変更・文書更新・Roadmap更新はChatGPT側が直接実行し、Windows実機・Godot目視・Playtest等だけUserへ依頼する。
- Storage Decision: 共有パックはUserのDocumentsを散らかさず、App固有Dataの `hub-data/chatgpt-packs` 配下へ保存する。
- Prevention: AI handoffではState / Next Taskだけでなく、Execution ownership / completion expectation / clarification policyまで伝える。
