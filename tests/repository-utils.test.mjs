import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("parses worktree status", () => {
  const result = parsePorcelainStatus(" M project.godot\n?? notes.txt\n");
  assert.equal(result.dirty, true);
  assert.equal(result.changedCount, 2);
});

test("parses ahead/behind counts", () => {
  assert.deepEqual(parseAheadBehind("2\t3"), { ahead: 2, behind: 3 });
});
