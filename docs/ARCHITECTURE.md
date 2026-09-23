# Architecture

## 全体

```text
Game Dev Hub
├─ Electron Main Process
│  ├─ Project Registry
│  ├─ Git Repository Service
│  ├─ Godot Service
│  ├─ Settings
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
- Auto updater for Game Dev Hub itself
