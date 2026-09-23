import path from "node:path";

export const REGISTRY_VERSION = 1;

export const DEFAULT_PROJECT = Object.freeze({
  id: "deep-factory",
  name: "Deep Factory",
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

export function createProjectRecord({
  name,
  repositoryUrl,
  localPath,
  defaultBranch = "main",
  engine = "godot"
}) {
  const parsed = parseGitHubRepositoryUrl(repositoryUrl);
  if (!parsed) {
    throw new Error("GitHub Repository URLが正しくありません。");
  }

  const safeName = String(name ?? "").trim() || parsed.repo;
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
    id: makeProjectId(parsed.slug),
    name: safeName.slice(0, 100),
    repositoryUrl: parsed.cloneUrl,
    repositoryWebUrl: parsed.webUrl,
    repositorySlug: parsed.slug,
    localPath,
    defaultBranch: branch,
    engine
  };
}

export function normalizeRegistry(value) {
  const projects = Array.isArray(value?.projects) ? value.projects : [];

  return {
    version: REGISTRY_VERSION,
    projects: projects
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        try {
          return createProjectRecord(item);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  };
}
