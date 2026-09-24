import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  addReferenceImages,
  copyReferenceImages,
  listReferenceImages,
  loadDevelopmentTasks,
  parseRoadmapMarkdown,
  removeReferenceImage
} from "../src/services/development-workspace.mjs";

test("roadmap parser uses explicit checkboxes when a roadmap contains tracked tasks", () => {
  const parsed = parseRoadmapMarkdown(`
# Roadmap

## Phase 1 — Controller
- [x] WASD移動
- [x] マウスルック
- [ ] Windows実機確認

## Notes
- これは説明用の箇条書き
- これも進捗には数えない
`, "docs/ROADMAP.md");

  assert.equal(parsed.available, true);
  assert.equal(parsed.total, 3);
  assert.equal(parsed.done, 2);
  assert.equal(parsed.open, 1);
  assert.equal(parsed.currentSection, "Phase 1 — Controller");
  assert.equal(parsed.nextTask.text, "Windows実機確認");
  assert.equal(parsed.sourceFile, "docs/ROADMAP.md");
});

test("roadmap parser keeps legacy plain-bullet roadmaps working when no checkbox exists", () => {
  const parsed = parseRoadmapMarkdown(`
## Phase 1
- 岩シーン
- 採掘処理
`, "docs/ROADMAP.md");

  assert.equal(parsed.total, 2);
  assert.equal(parsed.open, 2);
  assert.equal(parsed.nextTask.text, "岩シーン");
});

test("roadmap task IDs remain stable when unrelated lines are inserted", () => {
  const first = parseRoadmapMarkdown("## Phase 1\n- [ ] 採掘処理\n", "docs/ROADMAP.md");
  const second = parseRoadmapMarkdown("# Title\n\n## Phase 1\n説明\n- [ ] 採掘処理\n", "docs/ROADMAP.md");

  assert.equal(first.sections[0].tasks[0].id, second.sections[0].tasks[0].id);
});

test("development tasks prefer docs/ROADMAP.md", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-roadmap-"));
  try {
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "ROADMAP.md"), "## Root\n- root task\n", "utf8");
    await fs.writeFile(path.join(root, "docs", "ROADMAP.md"), "## Docs\n- docs task\n", "utf8");

    const loaded = await loadDevelopmentTasks({ localPath: root });
    assert.equal(loaded.sourceFile, "docs/ROADMAP.md");
    assert.equal(loaded.nextTask.text, "docs task");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reference images are copied into Hub data and can be exported", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-media-"));
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-source-"));
  const packDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-pack-"));

  try {
    const source = path.join(sourceDir, "game screenshot.png");
    await fs.writeFile(source, Buffer.from([137, 80, 78, 71]));

    const added = await addReferenceImages(root, "deep-factory", [source]);
    assert.equal(added.accepted.length, 1);

    const listed = await listReferenceImages(root, "deep-factory");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].displayName, "game screenshot.png");

    const copied = await copyReferenceImages(root, "deep-factory", packDir);
    assert.deepEqual(copied, ["reference-images/game screenshot.png"]);
    await fs.access(path.join(packDir, "reference-images", "game screenshot.png"));

    await removeReferenceImage(root, "deep-factory", listed[0].id);
    assert.deepEqual(await listReferenceImages(root, "deep-factory"), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(sourceDir, { recursive: true, force: true });
    await fs.rm(packDir, { recursive: true, force: true });
  }
});


test("roadmap parser keeps nested guidance with its task and captures section completion", () => {
  const parsed = parseRoadmapMarkdown(`
## Phase 0 — Foundation
- [ ] Godotバージョン固定
  - 上部のGodot表示で実際のバージョンを確認する
  - ChatGPT共有パックへ状態を含める

完了条件:
同じGodotバージョンでProjectを開ける。
`, "docs/ROADMAP.md");

  assert.equal(parsed.total, 1);
  assert.equal(parsed.open, 1);
  assert.deepEqual(parsed.sections[0].tasks[0].steps, [
    "上部のGodot表示で実際のバージョンを確認する",
    "ChatGPT共有パックへ状態を含める"
  ]);
  assert.equal(parsed.sections[0].completionCriteria, "同じGodotバージョンでProjectを開ける。");
  assert.equal(parsed.nextTask.completionCriteria, "同じGodotバージョンでProjectを開ける。");
});


test("roadmap parser separates task ownership from action steps", () => {
  const parsed = parseRoadmapMarkdown(`
## Phase 1
- [ ] Windows実機確認
  - 担当: あなた
  - ゲームを起動して視点操作を確認する
- [ ] 岩シーン
  - 担当: ChatGPT
  - 岩SceneをRepositoryへ追加する
`, "docs/ROADMAP.md");

  assert.equal(parsed.sections[0].tasks[0].owner, "user");
  assert.deepEqual(parsed.sections[0].tasks[0].steps, [
    "ゲームを起動して視点操作を確認する"
  ]);
  assert.equal(parsed.sections[0].tasks[1].owner, "chatgpt");
  assert.deepEqual(parsed.sections[0].tasks[1].steps, [
    "岩SceneをRepositoryへ追加する"
  ]);
});
