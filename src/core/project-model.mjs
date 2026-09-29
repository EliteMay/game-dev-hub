import path from "node:path";

export const REGISTRY_VERSION = 2;
export const PROJECT_SOURCE_GITHUB = "github";
export const PROJECT_SOURCE_LOCAL = "local-prototype";

export const DEFAULT_PROJECT = Object.freeze({
  id: "deep-factory",
  name: "Deep Factory",
  sourceType: PROJECT_SOURCE_GITHUB,
  repositoryUrl: "https://github.com/EliteMay/deep-factory.git",
  repositoryWebUrl: "https://github.com/EliteMay/deep-factory",
  repositorySlug: "EliteMay/deep-factory",
  defaultBranch: "main",
  engine: "godot"
});

export function parseGitHubRepositoryUrl(input) {
  if (typeof input !== "string") return null;

  const value = input.trim();
  const ssh = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i);
  const https = value.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  const match = https || ssh;

  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  const slug = owner + "/" + repo;

  return {
    owner,
    repo,
    slug,
    cloneUrl: "https://github.com/" + slug + ".git",
    webUrl: "https://github.com/" + slug
  };
}

export function makeProjectId(slug) {
  return String(slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizedId(value, fallback) {
  const id = String(value || fallback || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) {
    throw new Error("Game IDが正しくありません。");
  }
  return id;
}

function normalizedCommon({ name, localPath, defaultBranch, engine }) {
  const branch = String(defaultBranch ?? "main").trim();
  if (!/^[A-Za-z0-9._\/-]{1,120}$/.test(branch)) {
    throw new Error("Default branchが正しくありません。");
  }

  if (engine !== "godot") {
    throw new Error("v0.1ではGodot Projectだけ登録できます。");
  }

  if (typeof localPath !== "string" || !path.isAbsolute(localPath)) {
    throw new Error("Local pathは絶対Pathで指定してください。");
  }

  return {
    name: String(name ?? "").trim().slice(0, 100),
    localPath,
    defaultBranch: branch,
    engine
  };
}

export function createProjectRecord({
  id,
  sourceType = PROJECT_SOURCE_GITHUB,
  name,
  repositoryUrl,
  localPath,
  defaultBranch = "main",
  engine = "godot",
  localSlug = ""
}) {
  const common = normalizedCommon({ name, localPath, defaultBranch, engine });

  if (sourceType === PROJECT_SOURCE_LOCAL) {
    const slug = makeProjectId(localSlug || common.name) || "prototype";
    const safeName = common.name || "Local Prototype";
    return {
      id: normalizedId(id, "local-" + slug),
      name: safeName,
      sourceType: PROJECT_SOURCE_LOCAL,
      repositoryUrl: "",
      repositoryWebUrl: "",
      repositorySlug: "local-prototype/" + slug,
      localSlug: slug,
      localPath: common.localPath,
      defaultBranch: common.defaultBranch,
      engine: common.engine
    };
  }

  if (sourceType !== PROJECT_SOURCE_GITHUB) {
    throw new Error("Gameの保存方式が正しくありません。");
  }

  const parsed = parseGitHubRepositoryUrl(repositoryUrl);
  if (!parsed) {
    throw new Error("GitHub Repository URLが正しくありません。");
  }

  return {
    id: normalizedId(id, makeProjectId(parsed.slug)),
    name: common.name || parsed.repo,
    sourceType: PROJECT_SOURCE_GITHUB,
    repositoryUrl: parsed.cloneUrl,
    repositoryWebUrl: parsed.webUrl,
    repositorySlug: parsed.slug,
    localPath: common.localPath,
    defaultBranch: common.defaultBranch,
    engine: common.engine
  };
}

export function createLocalPrototypeRecord(input) {
  return createProjectRecord({
    ...input,
    sourceType: PROJECT_SOURCE_LOCAL,
    repositoryUrl: ""
  });
}

export function isLocalPrototypeProject(project) {
  return project?.sourceType === PROJECT_SOURCE_LOCAL;
}

export function normalizeRegistry(value) {
  const projects = Array.isArray(value?.projects) ? value.projects : [];

  return {
    version: REGISTRY_VERSION,
    projects: projects
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        try {
          return createProjectRecord({
            ...item,
            sourceType: item.sourceType || PROJECT_SOURCE_GITHUB
          });
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  };
}
