# UX Research / Direction

## Target Type

- Product: 個人用Windows Game Development Hub
- Primary Task: ゲーム選択 → Repository同期 → Editor起動
- Audience: Git / Godotの操作に詳しくなくても使えること
- Usage Frequency: 開発開始ごと
- Density: medium
- Primary Device: Windows Desktop
- Tone: calm / technical / dark

## References

### Unity Hub

Unityの公式ManualではUnity Hubを、Editor installationとProjectをまとめて管理し、Project一覧から適切なEditorで開く中心Applicationとして扱っている。

Transfer:
- Gameを一覧の中心に置く
- GameごとにEditor起動へ到達できる
- Tool自体とGame Projectを分離する

Do not copy:
- Unity Account / License / Asset Store中心の構造
- Unity固有のBrand表現

### Godot Project Manager

Godot Project ManagerはProjectのCreate / Import / Open / PlayをProject一覧から行える。

Transfer:
- Project中心の一覧
- Importと通常Openを分ける
- Project path / stateを確認できる

Do not copy:
- Godot Project Managerそのものの代替にしない
- Asset Library等のGame Dev Hubに不要な領域

### GitHub Desktop

GitHub DesktopはCLIを覚えなくてもRepositoryを扱え、Fetch / Pull等のcurrent stateに応じたActionを見せる。

Transfer:
- Repository stateを操作前に見せる
- dirty stateを隠さない
- Git commandではなくUser goalをButton名にする

Do not copy:
- Commit / PR creation等、v0.1で不要なGit authoring機能

## Direction

### KEEP

新規ProjectのためCurrent UIなし。

### Design Contract

- Left: Game list
- Main: selected Game status and Primary Action
- Top: App identity + global Git / Godot state
- Primary Action: 開発を開始
- Secondary: 最新化 / Godot / Game起動 / Folder / GitHub
- Add Game: list末尾またはheader
- State: text + status dot
- Log: lower detail area,常時主役にしない
- Dark neutral surfaces
- AccentはPrimary Actionとselected stateだけ
- Cardを過剰に増やさず、Project list + detailのmaster-detail構造


## 2026-09-24 Safety Stop / Task Guidance Review

### Trigger

Windows実機のGame Dev Hubで次のUser feedbackを確認した。

- `ローカル変更あり / 安全停止` は理由だけ表示され、どう解除するか分からない
- RoadmapのTaskをクリックすると `作業中` になるが、クリックしただけで実際の作業内容が分からない

### Task-first finding

Safety stateの必要情報:

```text
何が起きたか
→ GitHub同期だけ停止

何はできるか
→ GodotでLocal開発は継続可能

同期を再開するには
→ 変更を確認 → 必要なら保存/Commit、不要なら手動で元に戻す
→ 状態を再確認
→ cleanなら最新版へ同期
```

Task selectionの必要情報:

```text
Taskを選ぶ
→ Task titleだけでなく「今すること」を見る
→ Repository / Godot / ChatGPTで実作業
→ 完了条件を確認
→ Roadmap側の更新
→ Hubへ反映
```

Task click自体をexecutionやcompletionとして扱わない。

### Domain reference update

GitHub DesktopはChanges viewで変更Fileを可視化し、未Commit変更を隠さない。変更を破棄する場合も対象確認と明示操作を要求する。

- https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop
- https://docs.github.com/en/desktop/making-changes-in-a-branch/stashing-changes-in-github-desktop

Transfer:
- Block理由だけでなく変更対象を見せる
- Destructive operationを暗黙実行しない
- Current stateから次のActionへつなげる

Do not copy:
- HubへCommit / Stash / Discard機能をそのまま持ち込まない
- Git authoring UIをPrimary Taskへしない

### KEEP / FIX / REMOVE

KEEP:
- Dark neutral UI
- Game list + detailのmaster-detail
- Repository state card
- Repository-driven Roadmap
- Primary Action中心の構造

FIX:
- Safety stateをStatus-onlyからRecovery flowへする
- `作業中`を実行済みに見えない`今やるタスク`へ変更
- Task detail / completion criteriaを選択直後に表示
- dirty / offlineでもLocal actionをPrimary pathから使えるようにする

REMOVE:
- Task clickだけで「作業中」と断定する表現
- Safety stopでUserが次の操作を推測する状態

### Direction Contract

既存のVisual Directionは維持し、全面Redesignはしない。

- Safety recoveryはstatus cards直下のContextual panel
- Task guidanceはTask listと同じpanel内に表示
- warning colorはSafety stateに限定し、破壊操作Buttonは追加しない
- 選択中Taskの説明は常時のTask listより一段強いHierarchyにする
- Task detailがRepositoryに無い場合は、詳細を捏造せずChatGPT共有Flowへ案内する


## 2026-09-24 Local Change Save Flow

### User feedback

ローカル変更の意味を日本語化しても、User側に「結局残すのか消すのか」「どうGitHubへ反映するのか」というGit判断が残り、Primary Taskを完了できなかった。

### Revised task flow

```text
PC側に変更あり
→ 変更Fileと意味を見る
→ GitHubに保存
→ 保存前確認
→ PC側へ履歴保存
→ GitHub側が進んでいれば通常Merge
→ GitHubへ送信
→ clean / syncedへ戻る
```

Failure:

```text
秘密情報らしいFile
→ stage前に停止

Merge conflict
→ merge abort
→ Local Commit保持
→ ChatGPT確認 / manual recovery

Push failure
→ Local Commit保持
→ 「GitHubへの送信待ち」
→ 同じButtonで再試行
```

### UI decision

- dirty stateのPrimary recoveryは「GitHubに保存」
- 「Godotで続ける」はSecondary action
- Git command名は通常画面へ出さない
- 高Riskなforce/reset等は機能として提供しない
- 保存対象一覧と保存メモはConfirmation Dialogで確認する


## 2026-09-24 Manual Verification Result Flow Review

### Trigger

User担当のWindows実機確認Taskで「何を確認するか」は表示できるようになったが、確認後に結果を返すUIがなく、Userが別途ChatGPTへ自然言語で説明する必要があった。

### External reference

TestRailはManual test resultでStatusを必須とし、Passed / Failed / Blocked / Retestを持つ。CommentとAttachmentも結果Contextとして扱う。
- https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results

BrowserStack Test ManagementはStep単位でPass / Fail / Skip / Blocked / Retestを記録でき、Step結果からTest Case全体のStatusを決める。
- https://www.browserstack.com/docs/test-management/test-runs/add-a-result

GitHub Markdownでは進捗追跡するTaskを `- [ ]` / `- [x]` で明示する。
- https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-tasklists

### Transfer

- User確認はTask全体の単純なDoneだけでなくStepごとにResultを持つ
- Failure / Blockedには自由記述MemoとScreenshot Evidenceを添えられる
- Step結果からTask Summaryを自動算出する
- Resultには何を確認したかだけでなく、どのCommit / Godot Versionで確認したかを残す
- Tracked Taskと説明Bulletを明示的に分ける

### Do not copy

- Team QA向けの担当者管理、工数、Defect tracker等は個人用Hubには入れない
- Status種類を増やしすぎず、User向け表示は「できた / できなかった / 今は確認できない」の3択にする
- HubのUser確認だけでRoadmapを自動完了にはしない。Repository更新はChatGPT handoff後にEvidenceを見て反映する

### Additional friction found

1. Task手順が「ゲームを起動」なのにTask CardにはGodot Editor起動しかなく、ActionとInstructionが不一致
2. 完了済みTaskが常時大量表示され、現在Taskへ到達しにくい
3. 通常BulletをTask扱いしたため、説明・確認記録までProgress総数へ混入する
4. User確認結果にTested commit / Godot Versionが残らず、後から何を確認したEvidenceか曖昧になる
5. Roadmap手順更新後も古い確認結果を再利用すると誤Evidenceになる

### Adopted flow

```text
担当: あなた
→ Task Cardからゲームを起動
→ 各確認Stepで結果を選ぶ
   ├─ できた
   ├─ できなかった
   └─ 今は確認できない
→ 必要ならメモ / Screenshot
→ Hubへ自動保存
→ 結果入りChatGPT共有パック
→ ChatGPTがEvidence確認
→ 必要な修正 / Roadmap更新
→ Repository同期
```
