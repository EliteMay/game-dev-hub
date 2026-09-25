import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FOUNDATION_INSTALLATION_FILE,
  applyFoundationTemplate,
  inspectFoundationInstallation,
  updateManagedFoundationFromSource,
  validateFoundationManifest
} from "../src/services/foundation-template.mjs";

const commitA = "a".repeat(40);
const commitB = "b".repeat(40);

function manifest(version = "1.0.0") {
  return {
    schemaVersion: 1,
    foundationVersion: version,
    godotBaseline: "4.7.2",
    sourceRepository: "EliteMay/godot-game-foundation",
    sourceUrl: "https://github.com/EliteMay/godot-game-foundation.git",
    starterFiles: [
      {
        source: "starter/project.godot.template",
        target: "project.godot",
        tokens: true
      },
      {
        source: "starter/docs/ROADMAP.md.template",
        target: "docs/ROADMAP.md",
        tokens: true
      }
    ],
    managedPaths: ["addons/game_foundation"],
    tokens: [
      "{{GAME_NAME}}",
      "{{GAME_NAME_GODOT}}",
      "{{GAME_SLUG}}",
      "{{FOUNDATION_VERSION}}"
    ]
  };
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-foundation-"));
  const sourceRoot = path.join(root, "source");
  const targetRoot = path.join(root, "target");

  await fs.mkdir(path.join(sourceRoot, "starter", "docs"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "addons", "game_foundation"), { recursive: true });
  await fs.mkdir(targetRoot, { recursive: true });

  await fs.writeFile(
    path.join(sourceRoot, "starter", "project.godot.template"),
    'config/name="{{GAME_NAME_GODOT}}"\nfoundation="{{FOUNDATION_VERSION}}"\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(sourceRoot, "starter", "docs", "ROADMAP.md.template"),
    "# {{GAME_NAME}}\nrepo={{GAME_SLUG}}\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(sourceRoot, "addons", "game_foundation", "foundation.gd"),
    'const FOUNDATION_VERSION = "1.0.0"\n',
    "utf8"
  );

  return {
    root,
    sourceRoot,
    targetRoot,
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

test("foundation manifest rejects paths outside managed contract", () => {
  const invalid = manifest();
  invalid.starterFiles[0].target = "../project.godot";
  assert.throws(() => validateFoundationManifest(invalid), /Starter File|Path/);

  const expanded = manifest();
  expanded.managedPaths = ["addons/game_foundation", "scripts"];
  assert.throws(() => validateFoundationManifest(expanded), /管理Path/);
});

test("starter generation expands tokens and writes installation metadata", async () => {
  const f = await fixture();
  try {
    const metadata = await applyFoundationTemplate({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: manifest(),
      gameName: 'My "Game"',
      repositorySlug: "EliteMay/my-game",
      foundationCommit: commitA,
      installedAt: "2026-09-25T00:00:00.000Z"
    });

    assert.equal(metadata.foundationVersion, "1.0.0");
    assert.equal(metadata.foundationCommit, commitA);

    const project = await fs.readFile(path.join(f.targetRoot, "project.godot"), "utf8");
    assert.match(project, /config\/name="My \\"Game\\""/);
    assert.match(project, /foundation="1\.0\.0"/);

    const roadmap = await fs.readFile(path.join(f.targetRoot, "docs", "ROADMAP.md"), "utf8");
    assert.match(roadmap, /# My "Game"/);
    assert.match(roadmap, /EliteMay\/my-game/);

    assert.equal(
      await fs.readFile(path.join(f.targetRoot, "addons", "game_foundation", "foundation.gd"), "utf8"),
      'const FOUNDATION_VERSION = "1.0.0"\n'
    );

    const installed = JSON.parse(
      await fs.readFile(path.join(f.targetRoot, FOUNDATION_INSTALLATION_FILE), "utf8")
    );
    assert.deepEqual(installed.managedPaths, ["addons/game_foundation"]);
    assert.equal(installed.installedAt, "2026-09-25T00:00:00.000Z");

    const inspection = await inspectFoundationInstallation(f.targetRoot);
    assert.equal(inspection.installed, true);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.version, "1.0.0");
  } finally {
    await f.cleanup();
  }
});

test("foundation update changes only managed path and metadata", async () => {
  const f = await fixture();
  try {
    await applyFoundationTemplate({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: manifest(),
      gameName: "My Game",
      repositorySlug: "EliteMay/my-game",
      foundationCommit: commitA,
      installedAt: "2026-09-25T00:00:00.000Z"
    });

    await fs.mkdir(path.join(f.targetRoot, "scripts"), { recursive: true });
    await fs.writeFile(path.join(f.targetRoot, "scripts", "gameplay.gd"), "GAME-SPECIFIC\n", "utf8");
    await fs.writeFile(path.join(f.targetRoot, "docs", "ROADMAP.md"), "GAME ROADMAP\n", "utf8");

    await fs.writeFile(
      path.join(f.sourceRoot, "addons", "game_foundation", "foundation.gd"),
      'const FOUNDATION_VERSION = "1.1.0"\n',
      "utf8"
    );

    const updated = await updateManagedFoundationFromSource({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: manifest("1.1.0"),
      foundationCommit: commitB,
      installedAt: "2026-09-25T01:00:00.000Z"
    });

    assert.equal(updated.changed, true);
    assert.equal(updated.metadata.foundationVersion, "1.1.0");
    assert.equal(
      await fs.readFile(path.join(f.targetRoot, "addons", "game_foundation", "foundation.gd"), "utf8"),
      'const FOUNDATION_VERSION = "1.1.0"\n'
    );
    assert.equal(
      await fs.readFile(path.join(f.targetRoot, "scripts", "gameplay.gd"), "utf8"),
      "GAME-SPECIFIC\n"
    );
    assert.equal(
      await fs.readFile(path.join(f.targetRoot, "docs", "ROADMAP.md"), "utf8"),
      "GAME ROADMAP\n"
    );

    const inspection = await inspectFoundationInstallation(f.targetRoot);
    assert.equal(inspection.version, "1.1.0");
    assert.equal(inspection.commit, commitB);
  } finally {
    await f.cleanup();
  }
});

test("starter generation never overwrites an existing target file", async () => {
  const f = await fixture();
  try {
    await fs.writeFile(path.join(f.targetRoot, "project.godot"), "KEEP\n", "utf8");

    await assert.rejects(
      applyFoundationTemplate({
        sourceRoot: f.sourceRoot,
        targetRoot: f.targetRoot,
        manifest: manifest(),
        gameName: "My Game",
        repositorySlug: "EliteMay/my-game",
        foundationCommit: commitA
      }),
      /既存File/
    );

    assert.equal(
      await fs.readFile(path.join(f.targetRoot, "project.godot"), "utf8"),
      "KEEP\n"
    );
  } finally {
    await f.cleanup();
  }
});
