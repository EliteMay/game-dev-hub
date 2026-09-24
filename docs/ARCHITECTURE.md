# Architecture

## 全体

```text
Game Dev Hub
├─ Electron Main Process
│  ├─ Project Registry
│  ├─ Git Repository Service / explicit save + push
│  ├─ Godot Service
│  ├─ Settings / Desktop Foundation
│  ├─ Diagnostics / bounded local log
│  ├─ Development Workspace / Roadmap reader
│  ├─ Reference image local store / ChatGPT pack exporter
│  ├─ Window state / single instance / recovery
│  └─ Native dialogs / external launch
│
├─ Preload
│  └─ operation-specific IPC bridge
│
└─ Renderer
   ├─ Project list
   ├─ Selected project detail
   ├─ Status
   ├─ Actions
   └─ Log
```

## Project Model

概念Schema:

```json
{
  "id": "deep-factory",
  "name": "Deep Factory",
  "repositoryUrl": "https://github.com/EliteMay/deep-factory.git",
  "repositoryWebUrl": "https://github.com/EliteMay/deep-factory",
  "localPath": "C:/Users/.../Documents/Game Dev Hub/deep-factory",
  "defaultBranch": "main",
  "engine": "godot"
}
```

Hubはゲーム内容を知らない。

## Registry

`userData/hub-data/projects.json` をLocal Registryとする。v0.1.2以前のroot直下Fileはv0.1.3初回起動時にCopy Migrationし、Rollback用に旧Fileを削除しない。

初回起動時だけDeep FactoryをSeedする。

Registryは将来Schema migrationできるよう `version` を持つ。

## Settings

`userData/hub-data/settings.json`:

- schema version
- default projects root
- default Godot path
- last selected Game
- Window Size / Position / Maximized state

Project RegistryとGlobal Settingsを分離する。

## Desktop Foundation

```text
Electron Main
├─ App-specific data root: userData/hub-data
├─ Atomic JSON + backup recovery
├─ Bounded local JSONL diagnostics
├─ Window state clamp / restore
├─ Single instance focus
├─ Renderer crash recovery
├─ Stable update state
└─ Network capability state
```

診断ExportはProject名・Repository URL・File本文・Secretを含めず、Home Directoryを `%HOME%` 表記へRedactする。

## Process Boundary

RendererはOS Processを直接起動しない。

Main Processだけが次を固定Capabilityとして持つ。

- Git executable
- validated Godot executable
- Explorer folder open
- validated GitHub URL open

任意Command文字列はIPC payloadとして受け取らない。

## Repository Sync

```text
Inspect
↓
Expected origin?
↓
Expected branch?
↓
Clean worktree?
↓
fetch --prune origin
↓
pull --ff-only origin branch
↓
Inspect again
```

通常のRepository更新ではConflictやdirty stateを自動解決しない。

## Local Change Save

```text
Dirty worktree
↓
Userが「GitHubに保存」
↓
Main Processでorigin / branch / changed filesを再検証
↓
秘密情報らしいFileがないか確認
↓
git fetch --prune origin
↓
git add -A
↓
git commit
↓
Remoteが先行していれば通常Merge
├─ Conflict → merge --abort / Local Commit保持 / Stop
└─ Success
↓
git push origin HEAD:<defaultBranch>
↓
Inspect again
```

RendererへGit command文字列やPathを渡さず、operation-specific IPCの `saveRepositoryChanges` だけを公開する。

Pushだけ失敗した場合はLocal Commitを第二の失敗状態として保持し、Repositoryの `ahead > 0` を「GitHubへの送信待ち」として表示して再試行できる。

使用しないOperation:

- reset
- clean
- rebase
- force push

## Future

v0.1後の候補:

- Game template
- New GitHub Repository creation
- Godot Project bootstrap
- Engine version per Game
- Build / Export
- Releases
- Test status
- Game-specific task shortcuts
- Build / Export task managerの拡張
- Process Supervisorが必要な外部Runtimeを将来扱う場合の共通管理


## Development Workspace Flow

```text
Game Repository
└─ docs/ROADMAP.md / ROADMAP.md / TODO.md
        ↓ read-only
Game Dev Hub
├─ Task list
├─ Active task (Settings only)
├─ Reference images (Hub local data)
└─ ChatGPT Pack Export
        ↓ explicit user action
Documents/Game Dev Hub/ChatGPT Packs/<game>-<timestamp>/
├─ game-dev-hub-report.json
├─ hub-screenshot.png
├─ CHATGPTに送る.txt
└─ reference-images/
```

Roadmap/TODOのTask completionはGame RepositoryがCanonicalです。HubはTask本文や完了状態の第二Source of Truthを持ちません。
