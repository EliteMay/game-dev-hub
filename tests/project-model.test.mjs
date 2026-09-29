import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  createLocalPrototypeRecord,
  createProjectRecord,
  isLocalPrototypeProject,
  makeProjectId,
  normalizeRegistry,
  parseGitHubRepositoryUrl,
  REGISTRY_VERSION
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

test("creates a normalized GitHub Godot project record", () => {
  const record = createProjectRecord({
    name: "Test Game",
    repositoryUrl: "https://github.com/EliteMay/test-game",
    localPath: path.resolve("C:/Games/test-game"),
    defaultBranch: "main",
    engine: "godot"
  });

  assert.equal(record.repositorySlug, "EliteMay/test-game");
  assert.equal(record.sourceType, "github");
  assert.equal(record.engine, "godot");
});


test("creates a normalized GitHub web project record", () => {
  const record = createProjectRecord({
    name: "Skin Aim Trainer",
    repositoryUrl: "https://github.com/EliteMay/Skin-Aim-Trainer",
    localPath: path.resolve("C:/Games/Skin-Aim-Trainer"),
    defaultBranch: "main",
    engine: "web"
  });

  assert.equal(record.repositorySlug, "EliteMay/Skin-Aim-Trainer");
  assert.equal(record.sourceType, "github");
  assert.equal(record.engine, "web");
});

test("rejects unsupported project engines", () => {
  assert.throws(() => createProjectRecord({
    name: "Unknown",
    repositoryUrl: "https://github.com/EliteMay/unknown",
    localPath: path.resolve("C:/Games/unknown"),
    defaultBranch: "main",
    engine: "unity"
  }), /対応していないProject種類/);
});

test("creates local prototype records without a GitHub remote", () => {
  const record = createLocalPrototypeRecord({
    id: "local-test-game",
    name: "Test Game",
    localSlug: "test-game",
    localPath: path.resolve("C:/Games/test-game"),
    defaultBranch: "main",
    engine: "godot"
  });

  assert.equal(record.id, "local-test-game");
  assert.equal(record.sourceType, "local-prototype");
  assert.equal(record.repositoryUrl, "");
  assert.equal(record.repositoryWebUrl, "");
  assert.equal(record.repositorySlug, "local-prototype/test-game");
  assert.equal(record.localSlug, "test-game");
  assert.equal(isLocalPrototypeProject(record), true);
});

test("registry v1 records migrate to GitHub sourceType without changing identity", () => {
  const localPath = path.resolve("C:/Games/test-game");
  const normalized = normalizeRegistry({
    version: 1,
    projects: [{
      id: "elitemay-test-game",
      name: "Test Game",
      repositoryUrl: "https://github.com/EliteMay/test-game.git",
      repositoryWebUrl: "https://github.com/EliteMay/test-game",
      repositorySlug: "EliteMay/test-game",
      localPath,
      defaultBranch: "main",
      engine: "godot"
    }]
  });

  assert.equal(normalized.version, REGISTRY_VERSION);
  assert.equal(normalized.projects.length, 1);
  assert.equal(normalized.projects[0].id, "elitemay-test-game");
  assert.equal(normalized.projects[0].sourceType, "github");
  assert.equal(normalized.projects[0].repositorySlug, "EliteMay/test-game");
});

test("explicit project id survives local-to-GitHub promotion normalization", () => {
  const record = createProjectRecord({
    id: "local-test-game",
    sourceType: "github",
    name: "Test Game",
    repositoryUrl: "https://github.com/EliteMay/test-game",
    localPath: path.resolve("C:/Games/test-game"),
    defaultBranch: "main",
    engine: "godot"
  });

  assert.equal(record.id, "local-test-game");
  assert.equal(record.sourceType, "github");
  assert.equal(record.repositorySlug, "EliteMay/test-game");
});
