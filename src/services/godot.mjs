import fs from "node:fs/promises";
import path from "node:path";
import { runFile, spawnDetached } from "../core/process.mjs";
import { HubError } from "./repository.mjs";

export function isAllowedGodotBasename(filePath) {
  const name = path.basename(String(filePath ?? ""));
  return /^godot(?:_v[0-9a-z.\-]+)?(?:_win64)?(?:_console)?\.exe$/i.test(name)
    || /^godot4?\.exe$/i.test(name);
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function validateGodotExecutable(filePath) {
  if (!filePath || !path.isAbsolute(filePath)) return false;
  if (!isAllowedGodotBasename(filePath)) return false;
  return isFile(filePath);
}

async function fromWhere(command) {
  try {
    const result = await runFile("where.exe", [command], { timeout: 8_000 });
    return result.stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

export async function detectGodot(savedPath = "") {
  const candidates = [];

  if (await validateGodotExecutable(savedPath)) {
    candidates.push(savedPath);
  }

  for (const command of ["godot.exe", "godot4.exe", "godot", "godot4"]) {
    candidates.push(...await fromWhere(command));
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "";

  for (const candidate of [
    localAppData && path.join(localAppData, "Programs", "Godot", "Godot.exe"),
    programFiles && path.join(programFiles, "Godot", "Godot.exe"),
    programFilesX86 && path.join(programFilesX86, "Godot", "Godot.exe")
  ]) {
    if (candidate) candidates.push(candidate);
  }

  const unique = [...new Set(candidates)]
    .filter(isAllowedGodotBasename)
    .sort((a, b) => Number(/_console\.exe$/i.test(a)) - Number(/_console\.exe$/i.test(b)));

  for (const candidate of unique) {
    if (!(await validateGodotExecutable(candidate))) continue;

    try {
      const versionResult = await runFile(candidate, ["--version"], { timeout: 10_000 });
      return {
        available: true,
        path: candidate,
        version: versionResult.stdout || "Godot"
      };
    } catch {
      // Try next candidate.
    }
  }

  return { available: false, path: "", version: "" };
}

export async function inspectSelectedGodot(filePath) {
  if (!(await validateGodotExecutable(filePath))) {
    throw new HubError(
      "GODOT_INVALID",
      "選択したFileをGodot executableとして確認できませんでした。"
    );
  }

  try {
    const result = await runFile(filePath, ["--version"], { timeout: 10_000 });
    return {
      available: true,
      path: filePath,
      version: result.stdout || "Godot"
    };
  } catch {
    throw new HubError(
      "GODOT_INVALID",
      "Godotを起動確認できませんでした。別のGodot.exeを選んでください。"
    );
  }
}

export function openGodotEditor(godotPath, project) {
  return spawnDetached(
    godotPath,
    ["--editor", "--path", project.localPath],
    { cwd: project.localPath }
  );
}

export function runGodotProject(godotPath, project) {
  return spawnDetached(
    godotPath,
    ["--path", project.localPath],
    { cwd: project.localPath }
  );
}
