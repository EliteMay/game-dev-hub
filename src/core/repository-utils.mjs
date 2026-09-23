import { parseGitHubRepositoryUrl } from "./project-model.mjs";

export function normalizeRemote(value) {
  const parsed = parseGitHubRepositoryUrl(value);
  return parsed ? parsed.webUrl.toLowerCase() : "";
}

export function remoteMatchesProject(remoteUrl, project) {
  return normalizeRemote(remoteUrl) ===
    String(project?.repositoryWebUrl ?? "").toLowerCase();
}

export function parsePorcelainStatus(output) {
  const lines = String(output ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    dirty: lines.length > 0,
    changedCount: lines.length,
    lines
  };
}

export function parseAheadBehind(output) {
  const [aheadRaw = "0", behindRaw = "0"] = String(output ?? "").trim().split(/\s+/);
  const ahead = Number.parseInt(aheadRaw, 10);
  const behind = Number.parseInt(behindRaw, 10);

  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0
  };
}
