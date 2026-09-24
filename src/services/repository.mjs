import fs from "node:fs/promises";
import path from "node:path";
import { runFile } from "../core/process.mjs";
import {
  isSensitiveRepositoryPath,
  normalizeCommitMessage,
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
    changedFiles: [],
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
    base.changedFiles = status.files.slice(0, 20);
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

  const cloned = await inspectRepository(project);

  if (!cloned.valid) {
    throw new HubError(
      "NOT_GODOT_REPOSITORY",
      "Repositoryは取得できましたが、Godot Projectとして確認できません。project.godotとoriginを確認してください。"
    );
  }

  return cloned;
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
      "PC側に未保存の変更があります。変更を守るため「最新版にする」だけ停止しています。下の「GitHubに保存」で変更を残したまま保存するか、そのままGodotで作業を続けられます。"
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


async function fullRepositoryStatus(project) {
  const result = await git(["status", "--porcelain=v1"], project.localPath, 15_000);
  return parsePorcelainStatus(result.stdout);
}

async function ensureRepositoryCommitIdentity(project) {
  let name = "";
  let email = "";

  try {
    name = (await git(["config", "--get", "user.name"], project.localPath, 10_000)).stdout;
  } catch {
    name = "";
  }

  try {
    email = (await git(["config", "--get", "user.email"], project.localPath, 10_000)).stdout;
  } catch {
    email = "";
  }

  if (name && email) {
    return { configured: false, name, email };
  }

  const owner = String(project.repositorySlug || "")
    .split("/")[0]
    .replace(/[^a-z0-9_.-]/gi, "")
    .slice(0, 80) || "GameDevHub";

  if (!name) {
    name = owner;
    await git(["config", "user.name", name], project.localPath, 10_000);
  }

  if (!email) {
    email = owner + "@users.noreply.github.com";
    await git(["config", "user.email", email], project.localPath, 10_000);
  }

  return { configured: true, name, email };
}

async function mergeRemoteBranch(project) {
  try {
    await git(
      ["merge", "--no-edit", "origin/" + project.defaultBranch],
      project.localPath,
      120_000
    );
    return true;
  } catch {
    try {
      await git(["merge", "--abort"], project.localPath, 30_000);
    } catch {
      // If Git did not start a merge there is nothing to abort.
    }

    throw new HubError(
      "GIT_MERGE_CONFLICT",
      "PC側の変更は保存できましたが、GitHub側の新しい変更と自動で組み合わせられませんでした。変更は消えていません。ChatGPT確認データを作って共有してください。"
    );
  }
}

async function pushCurrentBranch(project) {
  try {
    await git(
      ["push", "origin", "HEAD:" + project.defaultBranch],
      project.localPath,
      180_000
    );
    return;
  } catch (error) {
    const detail = String(error?.message || "");

    if (!/non-fast-forward|fetch first|rejected/i.test(detail)) {
      throw new HubError(
        "GIT_PUSH_FAILED",
        "PC側には変更を保存できましたが、GitHubへ送れませんでした。GitHubへのサインイン状態やネット接続を確認して、もう一度「GitHubに保存」を押してください。"
      );
    }
  }

  await git(["fetch", "--prune", "origin"], project.localPath, 120_000);
  const delta = parseAheadBehind(
    (await git(
      ["rev-list", "--left-right", "--count", "HEAD...origin/" + project.defaultBranch],
      project.localPath,
      15_000
    )).stdout
  );

  if (delta.behind > 0) {
    await mergeRemoteBranch(project);
  }

  try {
    await git(
      ["push", "origin", "HEAD:" + project.defaultBranch],
      project.localPath,
      180_000
    );
  } catch {
    throw new HubError(
      "GIT_PUSH_FAILED",
      "PC側には変更を保存できましたが、GitHubへ送れませんでした。GitHubへのサインイン状態やネット接続を確認して、もう一度「GitHubに保存」を押してください。"
    );
  }
}

export async function saveRepositoryChanges(project, commitMessage) {
  const state = await inspectRepository(project);

  if (!state.valid) {
    throw new HubError(
      "REPOSITORY_INVALID",
      "登録情報とPC上のRepositoryが一致しません。"
    );
  }

  if (state.branch !== project.defaultBranch) {
    throw new HubError(
      "WRONG_BRANCH",
      "現在のブランチが " + project.defaultBranch + " ではないため、GitHubへの保存を止めました。"
    );
  }

  await git(["fetch", "--prune", "origin"], project.localPath, 120_000);

  if (state.dirty) {
    const status = await fullRepositoryStatus(project);
    const sensitive = status.files.filter((file) => isSensitiveRepositoryPath(file.path));

    if (sensitive.length) {
      throw new HubError(
        "SENSITIVE_FILE_BLOCKED",
        "秘密情報の可能性があるファイルが含まれているため自動保存を止めました: " +
          sensitive.slice(0, 3).map((file) => file.path).join(", ")
      );
    }

    await ensureRepositoryCommitIdentity(project);
    await git(["add", "-A"], project.localPath, 60_000);
    const staged = await git(["diff", "--cached", "--name-only"], project.localPath, 15_000);

    if (staged.stdout) {
      const message = normalizeCommitMessage(commitMessage);
      await git(["commit", "-m", message], project.localPath, 120_000);
    }
  }

  const delta = parseAheadBehind(
    (await git(
      ["rev-list", "--left-right", "--count", "HEAD...origin/" + project.defaultBranch],
      project.localPath,
      15_000
    )).stdout
  );

  let mergedRemote = false;

  if (delta.ahead === 0 && delta.behind === 0) {
    const repository = await inspectRepository(project);
    return {
      repository,
      commit: repository.commit,
      mergedRemote: false,
      message: "GitHubへ送る変更はありません。"
    };
  }

  if (delta.behind > 0 && delta.ahead > 0) {
    mergedRemote = await mergeRemoteBranch(project);
  } else if (delta.behind > 0 && delta.ahead === 0) {
    await git(
      ["pull", "--ff-only", "origin", project.defaultBranch],
      project.localPath,
      120_000
    );
    const repository = await inspectRepository(project);
    return {
      repository,
      commit: repository.commit,
      mergedRemote: true,
      message: "GitHubの新しい変更をPCへ取り込みました。"
    };
  }

  await pushCurrentBranch(project);

  const repository = await inspectRepository(project);
  const commit = (
    await git(["rev-parse", "--short=8", "HEAD"], project.localPath, 10_000)
  ).stdout;

  return {
    repository,
    commit,
    mergedRemote,
    message: mergedRemote
      ? "PC側の変更を保存し、GitHubの新しい変更も取り込んでGitHubへ保存しました。"
      : "PC側の変更をGitHubへ保存しました。"
  };
}
