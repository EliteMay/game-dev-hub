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

export async function readJsonRecovering(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      value: JSON.parse(raw),
      recovered: false,
      fallbackUsed: false
    };
  } catch {
    const backupPath = filePath + ".backup.json";

    try {
      const backupRaw = await fs.readFile(backupPath, "utf8");
      const backup = JSON.parse(backupRaw);
      const corruptPath = filePath + ".corrupt.json";
      const tempPath = filePath + ".restore.tmp";

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.rm(corruptPath, { force: true });

      try {
        await fs.rename(filePath, corruptPath);
      } catch {
        // Missing primary file is fine when only the backup exists.
      }

      await fs.writeFile(tempPath, JSON.stringify(backup, null, 2) + "\n", "utf8");
      await fs.rename(tempPath, filePath);

      return {
        value: backup,
        recovered: true,
        fallbackUsed: false
      };
    } catch {
      const corruptPath = filePath + ".corrupt.json";

      try {
        await fs.rm(corruptPath, { force: true });
        await fs.rename(filePath, corruptPath);
      } catch {
        // Missing primary file is fine. The caller can recreate a safe default.
      }

      return {
        value: fallback,
        recovered: false,
        fallbackUsed: true
      };
    }
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
