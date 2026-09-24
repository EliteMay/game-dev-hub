# Project Rules

## Projectの役割

このRepositoryは**Game Dev Hubアプリ本体**だけを管理する。

各ゲームは別Repositoryとして分離する。

例:

```text
EliteMay/game-dev-hub
EliteMay/deep-factory
EliteMay/another-game
```

## ゲーム固有情報を混ぜない

Hubに保持してよい:

- 表示名
- Repository URL
- Local path
- Default branch
- Engine type
- Engine executable path
- 開発開始に必要な状態

各Game Repositoryに保持する:

- Game Design
- World setting
- Core loop
- Gameplay code
- Assets
- Save format
- Balance
- Roadmap
- Release

## GitHub中心

Current Stateは現在のGitHub Repositoryを確認する。

古い会話・古いZIP・Memoryだけを最新版として扱わない。

## 操作性

Primary Taskは「ゲームを選んで開発を開始する」。

高度なGit操作を覚えないと使えないUIにしない。

## Safety

- RendererへNode APIを直接公開しない
- 任意Shell実行Capabilityを追加しない
- Repository同期でローカル変更を勝手に捨てない
- GitHub保存はUserが明示的に押した場合だけ行い、reset / clean / rebase / force pushを使わない
- Secret / Tokenを保存しない
- 未確認のWindows固有挙動を確認済み扱いにしない


## Electron Desktop Foundation

- Settings / Registryの正本は `userData/hub-data` とし、Chromium管理Fileと同じrootへApp固有Fileを増やさない
- Window State、Last selected Game、Diagnosticsは既存Settings / Foundationへ統合し、同じ状態の第二Source of Truthを作らない
- Persistent Logはboundedに保ち、Token / Secret / User File本文 / Repository URL /不要な個人Pathを記録しない
- Diagnostic ExportはSanitize済みSnapshotだけをUserの明示操作で作る
- Renderer crash recoveryはData削除や無限RestartをDefaultにしない
- Network failure時もLocal-only機能まで一括停止しない
- Secretを導入する将来Featureでは通常settings.jsonへ平文保存しない

## Development Workspace

- Roadmap / TODOの完了状態は各Game RepositoryをSource of Truthとし、Hubへ第二のTask DBを作らない
- Hub Settingsへ保存してよいのは「現在選択しているTask」のようなWorkspace stateだけとする
- HubはRoadmapを自動編集しない。Userが「GitHubに保存」を押した場合は、Roadmapを含むCurrent worktree変更を他の変更と同じ確認対象として保存できる
- GitHub保存はCurrent registered Repository / expected branchだけを対象にし、秘密情報らしいFileを検出した場合は停止する
- 参考画像は `userData/hub-data/project-media/<project-id>` へCopyし、Game Repositoryへ暗黙追加しない
- ChatGPT共有パックはUserの明示操作でのみ生成する
- ChatGPT共有JSONにCredential / Token / Secret / Source File本文を含めない
- 実プレイ結果はRuntime snapshotやStatic stateだけから完了扱いにしない
