import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runFile(file, args = [], options = {}) {
  try {
    const result = await execFileAsync(file, args, {
      cwd: options.cwd,
      windowsHide: true,
      encoding: "utf8",
      timeout: options.timeout ?? 60_000,
      maxBuffer: options.maxBuffer ?? 1_000_000,
      env: { ...process.env, ...(options.env ?? {}) }
    });

    return {
      stdout: String(result.stdout ?? "").trim(),
      stderr: String(result.stderr ?? "").trim()
    };
  } catch (error) {
    const wrapped = new Error(
      String(error.stderr || error.stdout || error.message || "Command failed").trim()
    );
    wrapped.code = error.code;
    wrapped.stdout = String(error.stdout ?? "").trim();
    wrapped.stderr = String(error.stderr ?? "").trim();
    throw wrapped;
  }
}

export function spawnDetached(file, args = [], options = {}) {
  const child = spawn(file, args, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    shell: false
  });

  child.unref();
  return child.pid;
}
