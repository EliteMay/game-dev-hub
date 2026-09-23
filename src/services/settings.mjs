import path from "node:path";
import { readJson, writeJsonAtomic } from "./storage.mjs";

const SETTINGS_VERSION = 1;

function absoluteOrEmpty(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && path.isAbsolute(trimmed) ? trimmed : "";
}

export function sanitizeSettings(value = {}, defaults = {}) {
  return {
    version: SETTINGS_VERSION,
    projectsRoot: absoluteOrEmpty(value.projectsRoot) ||
      absoluteOrEmpty(defaults.projectsRoot),
    godotPath: absoluteOrEmpty(value.godotPath)
  };
}

export async function loadSettings(userDataPath, defaults = {}) {
  const filePath = path.join(userDataPath, "settings.json");
  const raw = await readJson(filePath, {});
  return sanitizeSettings(raw, defaults);
}

export async function saveSettings(userDataPath, settings, defaults = {}) {
  const safe = sanitizeSettings(settings, defaults);
  await writeJsonAtomic(path.join(userDataPath, "settings.json"), safe);
  return safe;
}
