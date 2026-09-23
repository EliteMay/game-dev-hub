import fs from "node:fs/promises";
import path from "node:path";

export async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = filePath + ".tmp";
  const backupPath = filePath + ".backup.json";
  const payload = JSON.stringify(value, null, 2) + "\n";

  try {
    await fs.copyFile(filePath, backupPath);
  } catch {
    // No previous file on first save.
  }

  await fs.writeFile(tempPath, payload, "utf8");
  await fs.rename(tempPath, filePath);
}
