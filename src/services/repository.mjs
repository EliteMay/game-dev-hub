import fs from "node:fs/promises";
import path from "node:path";
import { runFile } from "../core/process.mjs";
import {
  parseAheadBehind,
  parsePorcelainStatus,
  remoteMatchesProject
} from "../core/repository-utils.mjs";

export class HubError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HubError";
    this.code = code;
  }
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryIsEmpty(targetPath) {
  try {
    return (await fs.readdir(targetPath)).length === 0;
  } catch {
    return true;
  }
}

async function git(args, cwd, timeout = 60_000) {
  return runFile("git", args, { cwd, timeout });
}

export async function inspectGit() {
  try {
    const result = await runFile("git", ["--version"], { timeout: 10_000 });
    return { available: true, version: result.stdout || "git" };
  } catch {
    return { available: false, version: "" };
  }
}

export async function inspectRepository(project) {
  const base = {
    exists: false,
    valid: false,
    projectFile: false,
    expectedRemote: false,
    branch: "",
    commit: "",
    dirty: false,
    changedCount: 0,
    ahead: 0,
    behind: 0,
    origin: ""
  };

  if (!project?.localPath || !(await exists(project.localPath))) {
    return base;
  }

  base.exists = true;
  base.projectFile = await exists(path.join(project.localPath, "project.godot"));

  if (!(await exists(path.join(project.localPath, ".git")))) {
    return base;
  }

  try {
    const [
      branchResult,
      commitResult,
      statusResult,
      originResult
    ] = await Promise.all([
      git(["rev-parse", "--abbrev-ref", "HEAD"], project.localPath),
      git(["rev-parse", "--short=8", "HEAD"], project.localPath),
      git(["status", "--porcelain=v1"], project.localPath),
      git(["remote", "get-url", "origin"], project.localPath)
    ]);

    const status = parsePorcelainStatus(statusResult.stdout);
    base.branch = branchResult.stdout;
    base.commit = commitResult.stdout;
    base.dirty = status.dirty;
    base.changedCount = status.changedCount;
    base.origin = originResult.stdout;
    base.expectedRemote = remoteMatchesProject(base.origin, project);
    base.valid = base.projectFile && base.expectedRemote;

    try {
      const delta = await git(
        [
          "rev-list",
          "--left-right",
          "--count",
          "HEAD...origin/" + project.defaultBranch
        ],
        project.localPath,
        10_000
      );

      Object.assign(base, parseAheadBehind(delta.stdout));
    } catch {
      // Remote tracking data may not exist before first fetch.
    }

    return base;
  } catch {
    return base;
  }
}

export async function cloneProject(project) {
  const gitState = await inspectGit();

  if (!gitState.available) {
    throw new HubError(
      "GIT_MISSING",
      "Gitが見つかりません。Git for Windowsをインストールしてから再試行してください。"
    );
  }

  const parent = path.dirname(project.localPath);
  await fs.mkdir(parent, { recursive: true });

  if (await exists(project.localPath)) {
    if (!(await directoryIsEmpty(project.localPath))) {
      throw new HubError(
        "PATH_NOT_EMPTY",
        "保存先に別のFileがあります。既存Repositoryを登録するか、空の保存先を使ってください。"
      );
    }
  }

  await git(
    ["clone", "--origin", "origin", project.repositoryUrl, project.localPath],
    parent,
    180_000
  );

  return inspectRepository(project);
}

export async function syncProject(project) {
  const state = await inspectRepository(project);

  if (!state.valid) {
    throw new HubError(
      "REPOSITORY_INVALID",
      "登録情報とLocal Repositoryが一致しません。Repository Pathとoriginを確認してください。"
    );
  }

  if (state.dirty) {
    throw new HubError(
      "DIRTY_WORKTREE",
      "Localに未Commitの変更があります。内容を消さないため自動更新を停止しました。"
    );
  }

  if (state.branch !== project.defaultBranch) {
    throw new HubError(
      "WRONG_BRANCH",
      "現在のBranchが " + project.defaultBranch + " ではないため自動更新を停止しました。"
    );
  }

  await git(["fetch", "--prune", "origin"], project.localPath, 120_000);
  await git(
    ["pull", "--ff-only", "origin", project.defaultBranch],
    project.localPath,
    120_000
  );

  return inspectRepository(project);
}

export async function prepareProject(project) {
  const state = await inspectRepository(project);

  if (!state.exists) {
    return { action: "cloned", repository: await cloneProject(project) };
  }

  if (!state.valid) {
    throw new HubError(
      "REPOSITORY_INVALID",
      "登録Pathに正しいGame Repositoryがありません。"
    );
  }

  return { action: "synced", repository: await syncProject(project) };
}
