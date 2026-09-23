import path from "node:path";
import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

const SETTINGS_VERSION = 3;

function absoluteOrEmpty(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && path.isAbsolute(trimmed) ? trimmed : "";
}

function projectIdOrEmpty(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length <= 100 ? trimmed : "";
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function sizeOrDefault(value, fallback, minimum) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.round(value))
    : fallback;
}

function sanitizeWindowState(value = {}, defaults = {}) {
  return {
    width: sizeOrDefault(value.width, sizeOrDefault(defaults.width, 1240, 940), 940),
    height: sizeOrDefault(value.height, sizeOrDefault(defaults.height, 790, 640), 640),
    x: finiteOrNull(value.x),
    y: finiteOrNull(value.y),
    maximized: value.maximized === true
  };
}

function sanitizeActiveTaskMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const safe = {};
  for (const [projectId, taskId] of Object.entries(value)) {
    if (!/^[a-z0-9-]{1,100}$/.test(projectId)) continue;
    if (typeof taskId !== "string" || taskId.length > 100) continue;
    safe[projectId] = taskId;
    if (Object.keys(safe).length >= 100) break;
  }
  return safe;
}

export function sanitizeSettings(value = {}, defaults = {}) {
  return {
    version: SETTINGS_VERSION,
    projectsRoot: absoluteOrEmpty(value.projectsRoot) ||
      absoluteOrEmpty(defaults.projectsRoot),
    godotPath: absoluteOrEmpty(value.godotPath),
    lastSelectedProjectId: projectIdOrEmpty(value.lastSelectedProjectId),
    activeTaskByProject: sanitizeActiveTaskMap(value.activeTaskByProject),
    window: sanitizeWindowState(value.window, defaults.window)
  };
}

export async function loadSettings(userDataPath, defaults = {}) {
  const filePath = path.join(userDataPath, "settings.json");
  const loaded = await readJsonRecovering(filePath, {});
  const safe = sanitizeSettings(loaded.value, defaults);

  if (JSON.stringify(loaded.value) !== JSON.stringify(safe)) {
    await writeJsonAtomic(filePath, safe);
  }

  return safe;
}

export async function saveSettings(userDataPath, settings, defaults = {}) {
  const safe = sanitizeSettings(settings, defaults);
  await writeJsonAtomic(path.join(userDataPath, "settings.json"), safe);
  return safe;
}
