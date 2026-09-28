import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FOUNDATION_INSTALLATION_FILE,
  applyFoundationTemplate,
  foundationProfileCatalog,
  inspectFoundationInstallation,
  resolveFoundationProfile,
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
    ],
    defaultProfile: "minimal",
    starterProfiles: [
      {
        id: "minimal",
        label: "最小構成",
        description: "既存互換Starter",
        selectable: true,
        capabilities: ["integrated_foundation_runtime"]
      },
      {
        id: "standard",
        label: "標準構成",
        description: "共通Shell付きStarter",
        selectable: true,
        capabilities: ["application_shell", "recovery_screen_contract"],
        starterFiles: [
          {
            source: "starter/standard/project.godot.template",
            target: "project.godot",
            tokens: true
          },
          {
            source: "starter/docs/ROADMAP.md.template",
            target: "docs/ROADMAP.md",
            tokens: true
          }
        ]
      }
    ]
  };
}

function legacyManifest(version = "1.0.0") {
  const value = manifest(version);
  delete value.defaultProfile;
  delete value.starterProfiles;
  return value;
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-foundation-"));
  const sourceRoot = path.join(root, "source");
  const targetRoot = path.join(root, "target");

  await fs.mkdir(path.join(sourceRoot, "starter", "docs"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "starter", "standard"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "addons", "game_foundation"), { recursive: true });
  await fs.mkdir(targetRoot, { recursive: true });

  await fs.writeFile(
    path.join(sourceRoot, "starter", "project.godot.template"),
    'config/name="{{GAME_NAME_GODOT}}"\nprofile="minimal"\nfoundation="{{FOUNDATION_VERSION}}"\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(sourceRoot, "starter", "standard", "project.godot.template"),
    'config/name="{{GAME_NAME_GODOT}}"\nprofile="standard"\nfoundation="{{FOUNDATION_VERSION}}"\n',
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
  assert.throws(() => validateFoundationManifest(invalid), /Starter|Path/);

  const expanded = manifest();
  expanded.managedPaths = ["addons/game_foundation", "scripts"];
  assert.throws(() => validateFoundationManifest(expanded), /管理Path/);
});

test("foundation manifest validates starter profile contract", () => {
  const value = manifest();
  assert.equal(validateFoundationManifest(value), value);

  const duplicate = manifest();
  duplicate.starterProfiles[1].id = "minimal";
  assert.throws(() => validateFoundationManifest(duplicate), /重複/);

  const unknownDefault = manifest();
  unknownDefault.defaultProfile = "missing";
  assert.throws(() => validateFoundationManifest(unknownDefault), /既定Starter構成/);

  const unsafeProfile = manifest();
  unsafeProfile.starterProfiles[1].starterFiles[0].source = "../outside.template";
  assert.throws(() => validateFoundationManifest(unsafeProfile), /Starter構成|正しく/);
});

test("profile catalog exposes safe selectable metadata without file paths", () => {
  const catalog = foundationProfileCatalog(manifest());
  assert.equal(catalog.defaultProfile, "minimal");
  assert.deepEqual(catalog.profiles.map((item) => item.id), ["minimal", "standard"]);
  assert.equal(catalog.profiles[1].label, "標準構成");
  assert.equal("starterFiles" in catalog.profiles[1], false);

  const standard = resolveFoundationProfile(manifest(), "standard");
  assert.equal(standard.id, "standard");
  assert.equal(standard.starterFiles[0].source, "starter/standard/project.godot.template");
});

test("default starter generation remains minimal and writes profile metadata", async () => {
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
    assert.equal(metadata.starterProfile, "minimal");

    const project = await fs.readFile(path.join(f.targetRoot, "project.godot"), "utf8");
    assert.match(project, /config\/name="My \\"Game\\""/);
    assert.match(project, /profile="minimal"/);
    assert.match(project, /foundation="1\.0\.0"/);

    const roadmap = await fs.readFile(path.join(f.targetRoot, "docs", "ROADMAP.md"), "utf8");
    assert.match(roadmap, /# My "Game"/);
    assert.match(roadmap, /EliteMay\/my-game/);

    const installed = JSON.parse(
      await fs.readFile(path.join(f.targetRoot, FOUNDATION_INSTALLATION_FILE), "utf8")
    );
    assert.equal(installed.starterProfile, "minimal");
    assert.deepEqual(installed.managedPaths, ["addons/game_foundation"]);

    const inspection = await inspectFoundationInstallation(f.targetRoot);
    assert.equal(inspection.installed, true);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.version, "1.0.0");
    assert.equal(inspection.profile, "minimal");
  } finally {
    await f.cleanup();
  }
});

test("standard starter uses profile-specific files and persists selection", async () => {
  const f = await fixture();
  try {
    const metadata = await applyFoundationTemplate({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: manifest(),
      gameName: "Standard Game",
      repositorySlug: "EliteMay/standard-game",
      foundationCommit: commitA,
      profileId: "standard",
      installedAt: "2026-09-25T00:00:00.000Z"
    });

    assert.equal(metadata.starterProfile, "standard");
    const project = await fs.readFile(path.join(f.targetRoot, "project.godot"), "utf8");
    assert.match(project, /profile="standard"/);
    assert.doesNotMatch(project, /profile="minimal"/);

    const inspection = await inspectFoundationInstallation(f.targetRoot);
    assert.equal(inspection.profile, "standard");
  } finally {
    await f.cleanup();
  }
});

test("unknown and unavailable starter profiles fail closed", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      applyFoundationTemplate({
        sourceRoot: f.sourceRoot,
        targetRoot: f.targetRoot,
        manifest: manifest(),
        gameName: "Unknown",
        repositorySlug: "EliteMay/unknown",
        foundationCommit: commitA,
        profileId: "missing"
      }),
      /Starter構成/
    );

    const unavailable = manifest();
    unavailable.starterProfiles[1].selectable = false;
    await assert.rejects(
      applyFoundationTemplate({
        sourceRoot: f.sourceRoot,
        targetRoot: f.targetRoot,
        manifest: unavailable,
        gameName: "Unavailable",
        repositorySlug: "EliteMay/unavailable",
        foundationCommit: commitA,
        profileId: "standard"
      }),
      /利用できません/
    );
  } finally {
    await f.cleanup();
  }
});

test("legacy manifest and installation metadata remain minimal-compatible", async () => {
  const f = await fixture();
  try {
    const metadata = await applyFoundationTemplate({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: legacyManifest(),
      gameName: "Legacy Game",
      repositorySlug: "EliteMay/legacy-game",
      foundationCommit: commitA
    });
    assert.equal(metadata.starterProfile, "minimal");

    const metadataPath = path.join(f.targetRoot, FOUNDATION_INSTALLATION_FILE);
    const installed = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    delete installed.starterProfile;
    await fs.writeFile(metadataPath, JSON.stringify(installed, null, 2) + "\n", "utf8");

    const inspection = await inspectFoundationInstallation(f.targetRoot);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.profile, "minimal");
  } finally {
    await f.cleanup();
  }
});

test("foundation update changes only managed path and preserves starter profile", async () => {
  const f = await fixture();
  try {
    await applyFoundationTemplate({
      sourceRoot: f.sourceRoot,
      targetRoot: f.targetRoot,
      manifest: manifest(),
      gameName: "My Game",
      repositorySlug: "EliteMay/my-game",
      foundationCommit: commitA,
      profileId: "standard",
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
    assert.equal(updated.metadata.starterProfile, "standard");
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
    assert.equal(inspection.profile, "standard");
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
