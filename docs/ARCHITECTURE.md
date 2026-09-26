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

## Windows AI Auto Test Boundary

```text
Renderer
  ↓ operation-specific IPC
Electron Main
  ├─ Auto Test Config / History Store
  ├─ Spawn selected game.exe (shell: false)
  ├─ UI-TARS GUIAgent
  │    └─ Scoped NutJS Operator
  └─ Active Window Guard
        ↓
Target Game Window only
```

CanonicalなGame Test定義とRun履歴はGame RepositoryではなくHubのProject-specific operational stateとして `hub-data/auto-tests/<project-id>/` へ保存する。Game implementation / RoadmapのSource of Truthは引き続き各Game Repositoryに置く。

AI Model / Operator:
- `@ui-tars/sdk 1.2.3`
- `@ui-tars/operator-nut-js 1.2.3`
- OpenAI-compatible UI-TARS Model endpoint
- API key is runtime-only and never enters canonical storage

Safety boundary:
- Rendererはexeを直接起動しない
- Userがnative dialogで選んだabsolute `.exe` だけをMain Processが起動する
- Spawnは `shell: false`
- AI OperatorはActive WindowがTargetと一致することを各Screenshot / Action前に確認する
- Mouse pointはActive Target Window bounds内だけ許可する
- OS-wide hotkeys / app switching hotkeysをAI actionから拒否する
- AbortController + Global Shortcut + Emergency Buttonで停止する
- Test Result / EvidenceはLocal-first。ChatGPT共有は既存の明示Exportだけ

Result actionは通常の `finished()` とは分け、Operatorへ `report_pass / report_fail / report_warning / report_unknown` を追加する。これにより「Agent loopが終わった」ことと「Testが成功した」ことを同一視しない。

Agent-SはPrimary implementationへ入れず、UI-TARSでCurrent Phaseの要件が成立しない場合だけAdapter候補とする。
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
hub-data/chatgpt-packs/<game>-<timestamp>/
├─ game-dev-hub-report.json
├─ hub-screenshot.png
├─ CHATGPTに送る.txt
└─ reference-images/
```

Roadmap/TODOのTask completionはGame RepositoryがCanonicalです。HubはTask本文や完了状態の第二Source of Truthを持ちません。


## Manual Verification State

User担当Taskの実機確認結果はGame Repositoryへ直接書き込まず、App DataへDerived Evidenceとして保存する。

```text
Roadmap Task (Source of Truth)
↓ task id + task signature
hub-data/task-verifications/<project-id>.json
↓
Step result / note / tested commit / Godot version / timestamp
↓
ChatGPT shared pack
↓
ChatGPTがEvidenceとして確認
↓
Game Repositoryの修正 / Roadmap completion update
```

Task signatureはSection / Task text / Owner / Steps / Completion criteriaから作る。Roadmap側の手順が変わってSignatureが変わった場合、保存済みResultはstaleとして再確認対象にする。

Hub verification stateはRoadmap completionの第二Source of Truthではない。


## Verification Batch Handoff

Task verification stateはTask単位で保存するが、ChatGPT共有Pack生成時はCurrent Roadmapにある全 `owner=user` Taskを集約する。

```text
task-verifications/<project>.json
+
Current Roadmap user-owned tasks
↓
allUserTaskResults[]
↓
verification.summary
↓
ChatGPT panel preview
↓
1 shared pack / 1 handoff
```

共有PackはActive Task Resultだけに依存せず、未確認Taskも `result: null` として含める。これによりChatGPTは「できた・問題あり・未確認」をGame単位でまとめて判断できる。


## Completed Verification Precedence

Verification stateはDerived Evidenceであり、Roadmap completionより上位の状態ではない。

```text
Roadmap [x] user task
↓
Canonical: completed
↓
Stored verification signature differs?
├─ Yes → completedのまま（staleにしない）
└─ No  → completedのまま

Roadmap [ ] user task
↓
Stored signature differs?
├─ Yes → stale / re-check
└─ No  → stored resultを利用
```

本当に再確認が必要な変更では、Game Repository側でTaskを `[ ]` へ戻す。これによりRepository Source of TruthとHubのDerived Evidenceが競合しない。

## Godot Game Foundation Integration

```text
EliteMay/godot-game-foundation
├─ foundation-template.json
├─ starter/*.template
└─ addons/game_foundation/
        ↓ dedicated Main-process service
Game Dev Hub
        ↓ explicit create
Empty GitHub Game Repository
├─ Game-specific starter files
├─ addons/game_foundation/
└─ .game-foundation.json
```

### Create boundary

Rendererはゲーム名とGitHub Repository URLだけをoperation-specific IPCへ渡す。

Main Process側で:

1. URLを既存GitHub URL Parserで正規化
2. Registry duplicateを確認
3. RemoteにRefがない空Repositoryであることを確認
4. Local保存先が未使用であることを確認
5. Foundation SourceをApp Data配下の一時Checkoutへ取得
6. ManifestをValidation
7. Starter File / Managed Pathを生成
8. Local Commitを作成してUser指定RemoteへPush
9. 成功後にRegistryへ登録

Create失敗かつRemote未変更の場合だけ、Hub自身が新規作成したLocal cloneをCleanupする。既存User Directoryを削除対象にしない。

### Update boundary

```text
Selected Game
→ expected origin / branch
→ clean worktree
→ unpushed commitなし
→ normal ff-only sync
→ .game-foundation.json validation
→ latest Manifest validation
→ managedPaths contract一致
→ addons/game_foundationのみ更新
→ working tree dirty
→ Userが既存「GitHubに保存」で確認
```

Foundation Update IPCは任意PathやCommandを受け取らない。Managed Pathが将来変わった場合は自動で権限を拡大せず停止する。
