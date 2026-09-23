import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

export const FOUNDATION_DATA_DIR = "hub-data";
export const LOG_FILE_NAME = "game-dev-hub.jsonl";
export const MAX_LOG_BYTES = 512 * 1024;

function cleanText(value, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

function cleanDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const safe = {};
  for (const [key, detail] of Object.entries(value)) {
    const safeKey = cleanText(key, 60);
    if (!safeKey) continue;

    if (typeof detail === "boolean" || typeof detail === "number") {
      safe[safeKey] = detail;
    } else if (typeof detail === "string") {
      safe[safeKey] = cleanText(detail, 160);
    }
  }
  return safe;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function foundationDataPath(userDataPath) {
  return path.join(userDataPath, FOUNDATION_DATA_DIR);
}

export async function migrateLegacyUserData(userDataPath) {
  const targetDir = foundationDataPath(userDataPath);
  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  const names = [
    "settings.json",
    "settings.json.backup.json",
    "projects.json",
    "projects.json.backup.json"
  ];

  for (const name of names) {
    const source = path.join(userDataPath, name);
    const target = path.join(targetDir, name);

    if (!(await fileExists(source)) || await fileExists(target)) continue;

    try {
      await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
      copied.push(name);
    } catch {
      // Keep startup safe if another process or antivirus touched the file.
    }
  }

  return { dataPath: targetDir, copied };
}

export function resolveWindowPlacement(saved = {}, workArea = {}) {
  const area = {
    x: Number.isFinite(workArea.x) ? Math.round(workArea.x) : 0,
    y: Number.isFinite(workArea.y) ? Math.round(workArea.y) : 0,
    width: Math.max(940, Math.round(Number(workArea.width) || 1240)),
    height: Math.max(640, Math.round(Number(workArea.height) || 790))
  };

  const width = Math.min(
    area.width,
    Math.max(940, Math.round(Number(saved.width) || 1240))
  );
  const height = Math.min(
    area.height,
    Math.max(640, Math.round(Number(saved.height) || 790))
  );

  const fallbackX = area.x + Math.max(0, Math.floor((area.width - width) / 2));
  const fallbackY = area.y + Math.max(0, Math.floor((area.height - height) / 2));
  const requestedX = Number.isFinite(saved.x) ? Math.round(saved.x) : fallbackX;
  const requestedY = Number.isFinite(saved.y) ? Math.round(saved.y) : fallbackY;

  return {
    x: Math.min(Math.max(requestedX, area.x), area.x + area.width - width),
    y: Math.min(Math.max(requestedY, area.y), area.y + area.height - height),
    width,
    height
  };
}

async function rotateLogIfNeeded(logPath) {
  try {
    const stat = await fs.stat(logPath);
    if (stat.size < MAX_LOG_BYTES) return;
  } catch {
    return;
  }

  const archivePath = logPath + ".1";
  await fs.rm(archivePath, { force: true });
  await fs.rename(logPath, archivePath);
}

export async function appendFoundationLog(logsPath, entry = {}) {
  await fs.mkdir(logsPath, { recursive: true });

  const logPath = path.join(logsPath, LOG_FILE_NAME);
  await rotateLogIfNeeded(logPath);

  const record = {
    at: new Date().toISOString(),
    level: ["info", "warning", "error"].includes(entry.level) ? entry.level : "info",
    event: cleanText(entry.event, 80) || "unknown",
    code: cleanText(entry.code, 80) || undefined,
    details: cleanDetails(entry.details)
  };

  await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf8");
  return record;
}

async function readLogFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function readRecentFoundationLogs(logsPath, limit = 80) {
  const logPath = path.join(logsPath, LOG_FILE_NAME);
  const archive = await readLogFile(logPath + ".1");
  const current = await readLogFile(logPath);
  return [...archive, ...current].slice(-Math.max(1, Math.min(200, limit)));
}

export function redactHomePath(value, homePath) {
  if (typeof value !== "string" || !value) return "";
  if (typeof homePath !== "string" || !homePath) return value;

  const normalizedValue = path.resolve(value);
  const normalizedHome = path.resolve(homePath);
  const insensitive = process.platform === "win32";

  const candidate = insensitive ? normalizedValue.toLowerCase() : normalizedValue;
  const home = insensitive ? normalizedHome.toLowerCase() : normalizedHome;

  if (candidate === home) return "%HOME%";
  if (candidate.startsWith(home + path.sep)) {
    return "%HOME%" + normalizedValue.slice(normalizedHome.length);
  }

  return normalizedValue;
}
