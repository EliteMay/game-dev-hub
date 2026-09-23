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
