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
