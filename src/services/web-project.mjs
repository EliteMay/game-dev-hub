import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { runFile, spawnDetached } from "../core/process.mjs";
import { HubError } from "./repository.mjs";

export const WEB_PROJECT_METADATA_FILE = "game-dev-hub.json";

function isLoopbackHost(hostname) {
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function socketHostname(hostname) {
  return hostname === "[::1]" ? "::1" : hostname;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = net.createConnection({ host, port });

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(
      () => finish(new Error("Connection timeout")),
      timeoutMs
    );

    socket.once("connect", () => finish());
    socket.once("error", (error) => finish(error));
  });
}

export async function waitForLoopbackServer(value, options = {}) {
  const safeUrl = safeLoopbackUrl(value);
  if (!safeUrl) {
    throw new HubError(
      "WEB_DEV_URL_INVALID",
      "開発ServerのURLはlocalhost / 127.0.0.1 / ::1だけ利用できます。"
    );
  }

  const parsed = new URL(safeUrl);
  const host = socketHostname(parsed.hostname);
  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 15_000);
  const intervalMs = Math.max(25, Number(options.intervalMs) || 150);
  const connectTimeoutMs = Math.max(100, Number(options.connectTimeoutMs) || 500);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await canConnect(host, port, connectTimeoutMs);
      return true;
    } catch {
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        await delay(Math.min(intervalMs, remaining));
      }
    }
  }

  throw new HubError(
    "WEB_DEV_SERVER_NOT_READY",
    "開発Serverの起動を確認できませんでした。npm run dev のWindowを確認してから再試行してください。"
  );
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

async function webDevLaunchCommand() {
  if (process.platform === "win32") {
    try {
      await runFile("where.exe", ["npm.cmd"], { timeout: 8_000 });
    } catch {
      throw new HubError(
        "NPM_MISSING",
        "npmが見つかりません。Node.jsをインストールしてから再試行してください。"
      );
    }

    return {
      file: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd run dev"]
    };
  }

  try {
    await runFile("npm", ["--version"], { timeout: 8_000 });
  } catch {
    throw new HubError(
      "NPM_MISSING",
      "npmが見つかりません。Node.jsをインストールしてから再試行してください。"
    );
  }

  return {
    file: "npm",
    args: ["run", "dev"]
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

  const command = await webDevLaunchCommand();
  const pid = spawnDetached(command.file, command.args, {
    cwd: project.localPath
  });

  if (info.devUrl) {
    await waitForLoopbackServer(info.devUrl);
  }

  return {
    pid,
    devUrl: info.devUrl,
    packageName: info.packageName
  };
}
