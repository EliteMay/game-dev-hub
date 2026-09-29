import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createLocalPrototypeRecord } from "../src/core/project-model.mjs";
import {
  inspectRepository,
  prepareProject,
  saveRepositoryChanges
} from "../src/services/repository.mjs";

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-local-prototype-"));
  const projectRoot = path.join(root, "prototype");
  await fs.mkdir(projectRoot, { recursive: true });

  git(["init", "--initial-branch", "main"], projectRoot);
  git(["config", "user.name", "Game Dev Hub Test"], projectRoot);
  git(["config", "user.email", "game-dev-hub-test@example.invalid"], projectRoot);

  await fs.writeFile(
    path.join(projectRoot, "project.godot"),
    '[application]\nconfig/name="Local Prototype Test"\n',
    "utf8"
  );
  await fs.writeFile(path.join(projectRoot, "README.md"), "# Local Prototype\n", "utf8");
  git(["add", "-A"], projectRoot);
  git(["commit", "-m", "initial"], projectRoot);

  const project = createLocalPrototypeRecord({
    id: "local-prototype-test",
    name: "Local Prototype Test",
    localSlug: "prototype-test",
    localPath: projectRoot,
    defaultBranch: "main",
    engine: "godot"
  });

  return {
    root,
    projectRoot,
    project,
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

test("local prototype repository is valid without an origin remote", async () => {
  const f = await fixture();
  try {
    const state = await inspectRepository(f.project);
    assert.equal(state.exists, true);
    assert.equal(state.valid, true);
    assert.equal(state.expectedRemote, true);
    assert.equal(state.localPrototype, true);
    assert.equal(state.origin, "");
    assert.equal(state.branch, "main");
    assert.equal(state.ahead, 0);
    assert.equal(state.behind, 0);

    const prepared = await prepareProject(f.project);
    assert.equal(prepared.action, "local");
    assert.equal(prepared.repository.valid, true);
  } finally {
    await f.cleanup();
  }
});

test("local prototype save commits locally and never needs origin", async () => {
  const f = await fixture();
  try {
    const before = git(["rev-parse", "HEAD"], f.projectRoot);
    await fs.writeFile(path.join(f.projectRoot, "notes.txt"), "local change\n", "utf8");

    const result = await saveRepositoryChanges(
      f.project,
      "test: save prototype locally"
    );

    const after = git(["rev-parse", "HEAD"], f.projectRoot);
    assert.notEqual(after, before);
    assert.equal(result.repository.valid, true);
    assert.equal(result.repository.dirty, false);
    assert.match(result.message, /PC内のGit履歴/);
    assert.equal(git(["remote"], f.projectRoot), "");
    assert.equal(
      git(["log", "-1", "--pretty=%s"], f.projectRoot),
      "test: save prototype locally"
    );
  } finally {
    await f.cleanup();
  }
});
