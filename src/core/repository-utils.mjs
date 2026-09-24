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

  const files = lines.map((line) => {
    const status = line.slice(0, 2).trim() || "?";
    let filePath = line.length > 3 ? line.slice(3).trim() : line.trim();

    if (filePath.includes(" -> ")) {
      filePath = filePath.split(" -> ").at(-1);
    }

    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }

    return { status, path: filePath };
  });

  return {
    dirty: lines.length > 0,
    changedCount: lines.length,
    lines,
    files
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


export function isSensitiveRepositoryPath(filePath) {
  const value = String(filePath ?? "").replace(/\\/g, "/").toLowerCase();
  const base = value.split("/").at(-1) || "";

  if (base === ".env" || base.startsWith(".env.")) return true;
  if (["id_rsa", "id_ed25519", "credentials.json", "credentials.yml", "credentials.yaml"].includes(base)) return true;
  if (/\.(?:pem|p12|pfx|key)$/i.test(base)) return true;
  if (/(?:^|[-_.])(secret|secrets|token|tokens|password|passwd|credential|credentials)(?:[-_.]|$)/i.test(base)) return true;
  return false;
}

export function normalizeCommitMessage(value) {
  const cleaned = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned || "ゲーム開発の変更を保存";
}
