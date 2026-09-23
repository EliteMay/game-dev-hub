# Architecture

## 全体

```text
Game Dev Hub
├─ Electron Main Process
│  ├─ Project Registry
│  ├─ Git Repository Service
│  ├─ Godot Service
│  ├─ Settings
│  ├─ Auto Updater
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
   ├─ Update status / progress
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

`userData/projects.json` をLocal Registryとする。

初回起動時だけDeep FactoryをSeedする。

Registryは将来Schema migrationできるよう `version` を持つ。

## Settings

`userData/settings.json`:

- schema version
- default projects root
- default Godot path

Project RegistryとGlobal Settingsを分離する。

## Process Boundary

RendererはOS Processを直接起動しない。

Main Processだけが次を固定Capabilityとして持つ。

- Git executable
- validated Godot executable
- Explorer folder open
- validated GitHub URL open

任意Command文字列はIPC payloadとして受け取らない。

## Auto Update Boundary

```text
GitHub stable Release
├─ latest.yml
├─ Setup.exe
└─ blockmap
        ↓
Electron Main / electron-updater
        ↓ narrow IPC status/actions
Preload
        ↓
Renderer
```

- Providerは`EliteMay/game-dev-hub`へBuild時に固定する。
- Rendererはfeed URL・任意download URLを指定できない。
- 起動後はMain processが非同期でUpdate checkを行う。
- `autoDownload=false`で、Downloadはユーザー操作まで開始しない。
- `autoInstallOnAppQuit=false`で、明示した「再起動して更新」までInstallを開始しない。
- Update error時もGame Dev Hub本体は継続利用可能とする。
- Manual fallbackは固定されたGitHub Releases URLだけをMain processから開く。


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

Conflictやdirty stateは自動解決しない。

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
