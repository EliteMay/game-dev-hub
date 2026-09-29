import fs from "node:fs/promises";
import path from "node:path";
import { spawnDetached } from "../core/process.mjs";
import { HubError } from "./repository.mjs";

export const WEB_PROJECT_METADATA_FILE = "game-dev-hub.json";

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function safeLoopbackUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value));
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (!isLoopbackHost(parsed.hostname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export async function inspectWebProject(localPath) {
  const packagePath = path.join(localPath, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(await fs.readFile(packagePath, "utf8"));
  } catch {
    throw new HubError(
      "WEB_PACKAGE_INVALID",
      "Web Projectのpackage.jsonを読み取れません。"
    );
  }

  const devScript =
    typeof pkg?.scripts?.dev === "string" && pkg.scripts.dev.trim()
      ? "dev"
      : "";

  let devUrl = "";
  try {
    const metadata = JSON.parse(
      await fs.readFile(path.join(localPath, WEB_PROJECT_METADATA_FILE), "utf8")
    );
    if (metadata?.schemaVersion === 1 && metadata?.engine === "web") {
      devUrl = safeLoopbackUrl(metadata?.development?.url);
    }
  } catch {
    // Optional metadata. Running the project does not depend on it.
  }

  return {
    devScript,
    devUrl,
    packageName: String(pkg?.name || "")
  };
}

export async function runWebProject(project) {
  const info = await inspectWebProject(project.localPath);
  if (!info.devScript) {
    throw new HubError(
      "WEB_DEV_SCRIPT_MISSING",
      "package.json に scripts.dev がありません。Hubからは固定の npm run dev だけを実行します。"
    );
  }

  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const pid = spawnDetached(executable, ["run", "dev"], {
    cwd: project.localPath
  });

  return {
    pid,
    devUrl: info.devUrl,
    packageName: info.packageName
  };
}
