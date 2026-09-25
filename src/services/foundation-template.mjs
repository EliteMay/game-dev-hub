import fs from "node:fs/promises";
import path from "node:path";

import { runFile } from "../core/process.mjs";
import { HubError } from "./repository.mjs";

export const FOUNDATION_SOURCE_REPOSITORY = "EliteMay/godot-game-foundation";
export const FOUNDATION_SOURCE_URL = "https://github.com/EliteMay/godot-game-foundation.git";
export const FOUNDATION_SOURCE_BRANCH = "main";
export const FOUNDATION_INSTALLATION_FILE = ".game-foundation.json";
export const FOUNDATION_MANIFEST_FILE = "foundation-template.json";
export const FOUNDATION_INSTALLATION_SCHEMA_VERSION = 1;

function safeRelativePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\")) return false;
  if (path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && !normalized.startsWith("../") && normalized !== "..";
}

function inside(root, relativePath) {
  if (!safeRelativePath(relativePath)) {
    throw new HubError("FOUNDATION_PATH_INVALID", "Foundation Manifestに安全でないPathがあります。");
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ...relativePath.split("/"));
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new HubError("FOUNDATION_PATH_INVALID", "Foundation ManifestのPathが管理範囲外です。");
  }
  return resolved;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function git(args, cwd, timeout = 60_000) {
  return runFile("git", args, { cwd, timeout });
}

function godotString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

function replaceTemplateTokens(text, values) {
  return text
    .replaceAll("{{GAME_NAME}}", values.gameName)
    .replaceAll("{{GAME_NAME_GODOT}}", godotString(values.gameName))
    .replaceAll("{{GAME_SLUG}}", values.repositorySlug)
    .replaceAll("{{FOUNDATION_VERSION}}", values.foundationVersion);
}

export function validateFoundationManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new HubError("FOUNDATION_MANIFEST_INVALID", "Foundation Manifestが正しくありません。");
  }

  if (manifest.schemaVersion !== 1) {
    throw new HubError("FOUNDATION_MANIFEST_UNSUPPORTED", "Foundation ManifestのVersionに対応していません。");
  }

  if (manifest.sourceRepository !== FOUNDATION_SOURCE_REPOSITORY ||
      manifest.sourceUrl !== FOUNDATION_SOURCE_URL) {
    throw new HubError("FOUNDATION_SOURCE_MISMATCH", "Foundation Sourceが想定したRepositoryと一致しません。");
  }

  if (typeof manifest.foundationVersion !== "string" || !manifest.foundationVersion.trim()) {
    throw new HubError("FOUNDATION_VERSION_INVALID", "Foundation Versionが正しくありません。");
  }

  if (typeof manifest.godotBaseline !== "string" || !manifest.godotBaseline.trim()) {
    throw new HubError("FOUNDATION_GODOT_BASELINE_INVALID", "FoundationのGodot Versionが正しくありません。");
  }

  if (!Array.isArray(manifest.starterFiles) || manifest.starterFiles.length === 0) {
    throw new HubError("FOUNDATION_STARTER_FILES_INVALID", "Starter File一覧がありません。");
  }

  const targets = new Set();
  for (const item of manifest.starterFiles) {
    if (!item || typeof item !== "object" ||
        !safeRelativePath(item.source) ||
        !safeRelativePath(item.target) ||
        !item.source.startsWith("starter/")) {
      throw new HubError("FOUNDATION_STARTER_FILE_INVALID", "Starter File指定が正しくありません。");
    }

    if (item.target === FOUNDATION_INSTALLATION_FILE || item.target.startsWith(".git/")) {
      throw new HubError("FOUNDATION_STARTER_TARGET_INVALID", "Starterの出力先が予約領域と競合しています。");
    }

    if (targets.has(item.target)) {
      throw new HubError("FOUNDATION_STARTER_TARGET_DUPLICATE", "Starterの出力先が重複しています。");
    }
    targets.add(item.target);
  }

  if (!Array.isArray(manifest.managedPaths) ||
      manifest.managedPaths.length !== 1 ||
      manifest.managedPaths[0] !== "addons/game_foundation") {
    throw new HubError(
      "FOUNDATION_MANAGED_PATH_UNSUPPORTED",
      "Foundationの管理Pathが対応範囲と一致しません。"
    );
  }

  return manifest;
}

export async function readFoundationManifest(sourceRoot) {
  const filePath = path.join(sourceRoot, FOUNDATION_MANIFEST_FILE);
  let parsed;

  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    throw new HubError("FOUNDATION_MANIFEST_READ_FAILED", "Foundation Manifestを読み込めませんでした。");
  }

  return validateFoundationManifest(parsed);
}

function installationFrom(manifest, foundationCommit, installedAt = new Date().toISOString()) {
  return {
    schemaVersion: FOUNDATION_INSTALLATION_SCHEMA_VERSION,
    sourceRepository: manifest.sourceRepository,
    foundationVersion: manifest.foundationVersion,
    foundationCommit,
    managedPaths: [...manifest.managedPaths],
    installedAt
  };
}

function validateInstallation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HubError("FOUNDATION_INSTALLATION_INVALID", "Foundation導入情報が正しくありません。");
  }

  if (value.schemaVersion !== FOUNDATION_INSTALLATION_SCHEMA_VERSION ||
      value.sourceRepository !== FOUNDATION_SOURCE_REPOSITORY ||
      typeof value.foundationVersion !== "string" ||
      !/^[0-9a-f]{40}$/i.test(String(value.foundationCommit || "")) ||
      !Array.isArray(value.managedPaths) ||
      value.managedPaths.length !== 1 ||
      value.managedPaths[0] !== "addons/game_foundation") {
    throw new HubError("FOUNDATION_INSTALLATION_INVALID", "Foundation導入情報が現在のContractと一致しません。");
  }

  return value;
}

export async function inspectFoundationInstallation(projectRoot) {
  const metadataPath = path.join(projectRoot, FOUNDATION_INSTALLATION_FILE);
  if (!(await exists(metadataPath))) {
    return {
      installed: false,
      valid: false,
      version: "",
      commit: "",
      managedPaths: []
    };
  }

  try {
    const parsed = validateInstallation(JSON.parse(await fs.readFile(metadataPath, "utf8")));
    return {
      installed: true,
      valid: true,
      version: parsed.foundationVersion,
      commit: parsed.foundationCommit,
      managedPaths: [...parsed.managedPaths],
      sourceRepository: parsed.sourceRepository,
      installedAt: parsed.installedAt || ""
    };
  } catch (error) {
    return {
      installed: true,
      valid: false,
      version: "",
      commit: "",
      managedPaths: [],
      code: error?.code || "FOUNDATION_INSTALLATION_INVALID"
    };
  }
}

async function copyManagedPath(sourceRoot, targetRoot, managedPath) {
  const source = inside(sourceRoot, managedPath);
  const target = inside(targetRoot, managedPath);

  if (!(await exists(source))) {
    throw new HubError("FOUNDATION_MANAGED_SOURCE_MISSING", "Foundation管理Fileが見つかりません。");
  }

  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true, force: true });
}

async function writeInstallation(targetRoot, metadata) {
  const filePath = path.join(targetRoot, FOUNDATION_INSTALLATION_FILE);
  const tempPath = filePath + ".tmp";
  await fs.writeFile(tempPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  await fs.rename(tempPath, filePath);
}

export async function applyFoundationTemplate({
  sourceRoot,
  targetRoot,
  manifest,
  gameName,
  repositorySlug,
  foundationCommit,
  installedAt
}) {
  validateFoundationManifest(manifest);

  if (!/^[0-9a-f]{40}$/i.test(String(foundationCommit || ""))) {
    throw new HubError("FOUNDATION_COMMIT_INVALID", "Foundation Commitが正しくありません。");
  }

  for (const item of manifest.starterFiles) {
    const source = inside(sourceRoot, item.source);
    const target = inside(targetRoot, item.target);

    if (!(await exists(source))) {
      throw new HubError("FOUNDATION_STARTER_SOURCE_MISSING", "Starter Sourceが見つかりません: " + item.source);
    }
    if (await exists(target)) {
      throw new HubError("FOUNDATION_TARGET_EXISTS", "生成先に既存Fileがあります: " + item.target);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    if (item.tokens === true) {
      const text = await fs.readFile(source, "utf8");
      await fs.writeFile(
        target,
        replaceTemplateTokens(text, {
          gameName: String(gameName || "").trim(),
          repositorySlug,
          foundationVersion: manifest.foundationVersion
        }),
        "utf8"
      );
    } else {
      await fs.copyFile(source, target);
    }
  }

  for (const managedPath of manifest.managedPaths) {
    const target = inside(targetRoot, managedPath);
    if (await exists(target)) {
      throw new HubError("FOUNDATION_TARGET_EXISTS", "Foundation管理Pathがすでに存在します: " + managedPath);
    }
    await copyManagedPath(sourceRoot, targetRoot, managedPath);
  }

  const metadata = installationFrom(manifest, foundationCommit, installedAt);
  await writeInstallation(targetRoot, metadata);
  return metadata;
}

export async function updateManagedFoundationFromSource({
  sourceRoot,
  targetRoot,
  manifest,
  foundationCommit,
  installedAt
}) {
  validateFoundationManifest(manifest);

  const metadataPath = path.join(targetRoot, FOUNDATION_INSTALLATION_FILE);
  let current;
  try {
    current = validateInstallation(JSON.parse(await fs.readFile(metadataPath, "utf8")));
  } catch {
    throw new HubError("FOUNDATION_NOT_MANAGED", "このGameはFoundation管理情報がないため自動更新できません。");
  }

  if (JSON.stringify(current.managedPaths) !== JSON.stringify(manifest.managedPaths)) {
    throw new HubError(
      "FOUNDATION_MANAGED_PATH_CHANGED",
      "Foundation管理範囲が変更されています。自動更新を止めました。"
    );
  }

  if (current.foundationCommit === foundationCommit &&
      current.foundationVersion === manifest.foundationVersion) {
    return {
      changed: false,
      metadata: current
    };
  }

  for (const managedPath of manifest.managedPaths) {
    await copyManagedPath(sourceRoot, targetRoot, managedPath);
  }

  const metadata = installationFrom(manifest, foundationCommit, installedAt);
  await writeInstallation(targetRoot, metadata);
  return {
    changed: true,
    metadata
  };
}

async function ensureCommitIdentity(project) {
  let name = "";
  let email = "";

  try {
    name = (await git(["config", "--get", "user.name"], project.localPath, 10_000)).stdout;
  } catch {}

  try {
    email = (await git(["config", "--get", "user.email"], project.localPath, 10_000)).stdout;
  } catch {}

  const owner = String(project.repositorySlug || "")
    .split("/")[0]
    .replace(/[^a-z0-9_.-]/gi, "")
    .slice(0, 80) || "GameDevHub";

  if (!name) await git(["config", "user.name", owner], project.localPath, 10_000);
  if (!email) await git(["config", "user.email", owner + "@users.noreply.github.com"], project.localPath, 10_000);
}

async function withFoundationSource(appDataRoot, callback) {
  const parent = path.join(appDataRoot, "foundation-source");
  await fs.mkdir(parent, { recursive: true });
  const tempRoot = await fs.mkdtemp(path.join(parent, "checkout-"));
  const sourceRoot = path.join(tempRoot, "source");

  try {
    await git(
      ["clone", "--depth", "1", "--branch", FOUNDATION_SOURCE_BRANCH, FOUNDATION_SOURCE_URL, sourceRoot],
      tempRoot,
      180_000
    );
    const foundationCommit = (await git(["rev-parse", "HEAD"], sourceRoot, 10_000)).stdout;
    const manifest = await readFoundationManifest(sourceRoot);
    return await callback({ sourceRoot, foundationCommit, manifest });
  } catch (error) {
    if (error instanceof HubError) throw error;
    throw new HubError("FOUNDATION_FETCH_FAILED", "Godot Game Foundationの最新版を取得できませんでした。");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function bootstrapFoundationProject(project, appDataRoot) {
  if (await exists(project.localPath)) {
    throw new HubError(
      "FOUNDATION_LOCAL_PATH_EXISTS",
      "同じ保存先がすでにあります。既存Repositoryとして登録するか、別のRepository名を使ってください。"
    );
  }

  let localCreated = false;
  let remoteMutated = false;

  try {
    const remote = await git(["ls-remote", project.repositoryUrl], undefined, 30_000);
    if (remote.stdout.trim()) {
      throw new HubError(
        "FOUNDATION_REPOSITORY_NOT_EMPTY",
        "Foundationから作る場合は、Fileがない空のGitHub Repositoryを指定してください。"
      );
    }

    await fs.mkdir(path.dirname(project.localPath), { recursive: true });
    await git(["clone", project.repositoryUrl, project.localPath], path.dirname(project.localPath), 180_000);
    localCreated = true;
    await git(["symbolic-ref", "HEAD", "refs/heads/" + project.defaultBranch], project.localPath, 10_000);

    const metadata = await withFoundationSource(appDataRoot, async ({ sourceRoot, foundationCommit, manifest }) => {
      return applyFoundationTemplate({
        sourceRoot,
        targetRoot: project.localPath,
        manifest,
        gameName: project.name,
        repositorySlug: project.repositorySlug,
        foundationCommit
      });
    });

    await ensureCommitIdentity(project);
    await git(["add", "-A"], project.localPath, 60_000);
    const staged = (await git(["diff", "--cached", "--name-only"], project.localPath, 15_000)).stdout;
    if (!staged) {
      throw new HubError("FOUNDATION_GENERATION_EMPTY", "Starter Fileを生成できませんでした。");
    }

    await git(["commit", "-m", "chore: initialize game from Godot Game Foundation"], project.localPath, 120_000);
    await git(["push", "origin", "HEAD:" + project.defaultBranch], project.localPath, 180_000);
    remoteMutated = true;

    return {
      metadata,
      commit: (await git(["rev-parse", "HEAD"], project.localPath, 10_000)).stdout
    };
  } catch (error) {
    if (localCreated && !remoteMutated) {
      await fs.rm(project.localPath, { recursive: true, force: true }).catch(() => {});
    }
    if (error instanceof HubError) throw error;
    throw new HubError(
      "FOUNDATION_CREATE_FAILED",
      "Foundation付きGameを作成できませんでした。GitHubへの接続・権限・Repository状態を確認してください。"
    );
  }
}

export async function updateProjectFoundation(project, appDataRoot) {
  const installation = await inspectFoundationInstallation(project.localPath);
  if (!installation.installed || !installation.valid) {
    throw new HubError("FOUNDATION_NOT_MANAGED", "このGameはFoundation管理対象として確認できません。");
  }

  return withFoundationSource(appDataRoot, async ({ sourceRoot, foundationCommit, manifest }) => {
    const result = await updateManagedFoundationFromSource({
      sourceRoot,
      targetRoot: project.localPath,
      manifest,
      foundationCommit
    });

    return {
      ...result,
      foundationVersion: result.metadata.foundationVersion,
      foundationCommit: result.metadata.foundationCommit
    };
  });
}
