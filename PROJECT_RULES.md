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
- Secret / Tokenを保存しない
- 未確認のWindows固有挙動を確認済み扱いにしない
