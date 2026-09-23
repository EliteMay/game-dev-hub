import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  createProjectRecord,
  makeProjectId,
  parseGitHubRepositoryUrl
} from "../src/core/project-model.mjs";

test("parses HTTPS GitHub repository URL", () => {
  assert.deepEqual(
    parseGitHubRepositoryUrl("https://github.com/EliteMay/deep-factory.git"),
    {
      owner: "EliteMay",
      repo: "deep-factory",
      slug: "EliteMay/deep-factory",
      cloneUrl: "https://github.com/EliteMay/deep-factory.git",
      webUrl: "https://github.com/EliteMay/deep-factory"
    }
  );
});

test("parses SSH GitHub repository URL", () => {
  assert.equal(
    parseGitHubRepositoryUrl("git@github.com:EliteMay/deep-factory.git")?.slug,
    "EliteMay/deep-factory"
  );
});

test("rejects non-GitHub URL", () => {
  assert.equal(parseGitHubRepositoryUrl("https://example.com/a/b"), null);
});

test("creates stable project id", () => {
  assert.equal(makeProjectId("EliteMay/My Game"), "elitemay-my-game");
});

test("creates a normalized Godot project record", () => {
  const record = createProjectRecord({
    name: "Test Game",
    repositoryUrl: "https://github.com/EliteMay/test-game",
    localPath: path.resolve("C:/Games/test-game"),
    defaultBranch: "main",
    engine: "godot"
  });

  assert.equal(record.repositorySlug, "EliteMay/test-game");
  assert.equal(record.engine, "godot");
});
