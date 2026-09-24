import test from "node:test";
import assert from "node:assert/strict";

import {
  isSensitiveRepositoryPath,
  normalizeCommitMessage,
  normalizeRemote,
  parseAheadBehind,
  parsePorcelainStatus,
  remoteMatchesProject
} from "../src/core/repository-utils.mjs";

test("normalizes HTTPS and SSH origin", () => {
  assert.equal(
    normalizeRemote("git@github.com:EliteMay/deep-factory.git"),
    "https://github.com/elitemay/deep-factory"
  );
});

test("matches registered project remote", () => {
  assert.equal(
    remoteMatchesProject(
      "git@github.com:EliteMay/deep-factory.git",
      { repositoryWebUrl: "https://github.com/EliteMay/deep-factory" }
    ),
    true
  );
});

test("parses worktree status and exposes relative changed file names", () => {
  const result = parsePorcelainStatus(" M project.godot\n?? notes.txt\n");
  assert.equal(result.dirty, true);
  assert.equal(result.changedCount, 2);
  assert.deepEqual(result.files, [
    { status: "M", path: "project.godot" },
    { status: "??", path: "notes.txt" }
  ]);
});

test("parses rename destination for recovery display", () => {
  const result = parsePorcelainStatus("R  old-name.txt -> new-name.txt");
  assert.deepEqual(result.files, [{ status: "R", path: "new-name.txt" }]);
});

test("parses ahead/behind counts", () => {
  assert.deepEqual(parseAheadBehind("2\t3"), { ahead: 2, behind: 3 });
});


test("blocks common secret-bearing file names from automatic GitHub save", () => {
  assert.equal(isSensitiveRepositoryPath(".env"), true);
  assert.equal(isSensitiveRepositoryPath("config/.env.local"), true);
  assert.equal(isSensitiveRepositoryPath("keys/id_ed25519"), true);
  assert.equal(isSensitiveRepositoryPath("certs/private.key"), true);
  assert.equal(isSensitiveRepositoryPath("scripts/player/player_controller.gd.uid"), false);
  assert.equal(isSensitiveRepositoryPath("project.godot"), false);
});

test("normalizes commit messages and supplies a safe default", () => {
  assert.equal(normalizeCommitMessage("  変更\nを\t保存  "), "変更 を 保存");
  assert.equal(normalizeCommitMessage(""), "ゲーム開発の変更を保存");
  assert.equal(normalizeCommitMessage("x".repeat(200)).length, 120);
});
