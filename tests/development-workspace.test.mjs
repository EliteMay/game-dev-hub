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

test("roadmap parser keeps checked tasks and future bullet tasks", () => {
  const parsed = parseRoadmapMarkdown(`
# Roadmap

## Phase 1 — Controller
- [x] WASD移動
- [x] マウスルック
- [ ] Windows実機確認

## Phase 2 — Mining
- 岩シーン
- 採掘処理
`, "docs/ROADMAP.md");

  assert.equal(parsed.available, true);
  assert.equal(parsed.total, 5);
  assert.equal(parsed.done, 2);
  assert.equal(parsed.open, 3);
  assert.equal(parsed.currentSection, "Phase 1 — Controller");
  assert.equal(parsed.nextTask.text, "Windows実機確認");
  assert.equal(parsed.sections[1].tasks[0].done, false);
  assert.equal(parsed.sourceFile, "docs/ROADMAP.md");
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
