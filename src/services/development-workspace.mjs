import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const TASK_SOURCES = [
  "docs/ROADMAP.md",
  "ROADMAP.md",
  "docs/TODO.md",
  "TODO.md"
];

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_REFERENCE_IMAGES = 24;
const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024;

function cleanMarkdownText(value) {
  return String(value ?? "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function taskKey(section, text, occurrence) {
  return crypto
    .createHash("sha1")
    .update(section + "\0" + text + "\0" + occurrence)
    .digest("hex")
    .slice(0, 14);
}

export function parseRoadmapMarkdown(markdown, sourceFile = "") {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const hasExplicitTasks = lines.some((line) =>
    /^\s*[-*]\s+\[[ xX]\]\s+/.test(line)
  );
  const sections = [];
  const sectionMap = new Map();
  const occurrenceMap = new Map();
  let currentSection = "General";
  let lastTask = null;
  let completionSection = null;

  function ensureSection(title) {
    if (!sectionMap.has(title)) {
      const section = {
        title,
        tasks: [],
        completionCriteria: ""
      };
      sectionMap.set(title, section);
      sections.push(section);
    }
    return sectionMap.get(title);
  }

  function appendCompletion(section, text) {
    const cleaned = cleanMarkdownText(text);
    if (!cleaned) return;
    section.completionCriteria = section.completionCriteria
      ? section.completionCriteria + " " + cleaned
      : cleaned;
  }

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      currentSection = cleanMarkdownText(heading[1]) || "General";
      lastTask = null;
      completionSection = null;
      continue;
    }

    const completion = line.match(/^\s*完了条件\s*[:：]\s*(.*?)\s*$/);
    if (completion) {
      completionSection = ensureSection(currentSection);
      appendCompletion(completionSection, completion[1]);
      lastTask = null;
      continue;
    }

    const item = line.match(/^(\s*)[-*]\s+(?:\[([ xX])\]\s+)?(.+?)\s*$/);
    if (item) {
      const indent = item[1].replace(/\t/g, "    ").length;
      const text = cleanMarkdownText(item[3]);
      if (!text) continue;

      if (indent > 0 && lastTask) {
        const owner = text.match(/^担当\s*[:：]\s*(あなた|User|ユーザー|ChatGPT|Hub)$/i);
        if (owner) {
          const value = owner[1].toLowerCase();
          lastTask.owner =
            value === "chatgpt" ? "chatgpt" :
            value === "hub" ? "hub" :
            "user";
          completionSection = null;
          continue;
        }

        lastTask.steps.push(
          text.replace(/^(?:やること|手順|確認|完了の目安)\s*[:：]\s*/, "")
        );
        completionSection = null;
        continue;
      }

      if (hasExplicitTasks && !item[2]) {
        lastTask = null;
        completionSection = null;
        continue;
      }

      const section = ensureSection(currentSection);
      const occurrenceKey = currentSection + "\0" + text;
      const occurrence = (occurrenceMap.get(occurrenceKey) || 0) + 1;
      occurrenceMap.set(occurrenceKey, occurrence);

      lastTask = {
        id: taskKey(currentSection, text, occurrence),
        text,
        done: Boolean(item[2]) && item[2].toLowerCase() === "x",
        explicitCheckbox: Boolean(item[2]),
        owner: "",
        steps: []
      };
      section.tasks.push(lastTask);
      completionSection = null;
      continue;
    }

    if (completionSection) {
      const plain = cleanMarkdownText(line);
      if (plain) {
        appendCompletion(completionSection, plain);
      } else {
        completionSection = null;
      }
    }
  }

  const populated = sections.filter((section) => section.tasks.length > 0);
  const allTasks = populated.flatMap((section) =>
    section.tasks.map((task) => ({
      ...task,
      section: section.title,
      completionCriteria: section.completionCriteria
    }))
  );
  const done = allTasks.filter((task) => task.done).length;
  const nextTask = allTasks.find((task) => !task.done) || null;
  const currentSectionTitle = nextTask?.section || populated.at(-1)?.title || "";

  return {
    available: allTasks.length > 0,
    sourceFile,
    sections: populated,
    total: allTasks.length,
    done,
    open: allTasks.length - done,
    currentSection: currentSectionTitle,
    nextTask
  };
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function loadDevelopmentTasks(project) {
  if (!project?.localPath) {
    return {
      available: false,
      sourceFile: "",
      sections: [],
      total: 0,
      done: 0,
      open: 0,
      currentSection: "",
      nextTask: null
    };
  }

  for (const sourceFile of TASK_SOURCES) {
    const fullPath = path.join(project.localPath, ...sourceFile.split("/"));
    const markdown = await readIfExists(fullPath);
    if (markdown === null) continue;

    const parsed = parseRoadmapMarkdown(markdown, sourceFile);
    if (parsed.available) return parsed;
  }

  return {
    available: false,
    sourceFile: "",
    sections: [],
    total: 0,
    done: 0,
    open: 0,
    currentSection: "",
    nextTask: null
  };
}

function safeProjectId(projectId) {
  const value = String(projectId ?? "");
  if (!/^[a-z0-9-]{1,100}$/.test(value)) {
    throw new Error("Game IDが正しくありません。");
  }
  return value;
}

function safeImageId(imageId) {
  const value = String(imageId ?? "");
  if (!value || path.basename(value) !== value || value.length > 180) {
    throw new Error("画像IDが正しくありません。");
  }
  if (!IMAGE_EXTENSIONS.has(path.extname(value).toLowerCase())) {
    throw new Error("対応していない画像形式です。");
  }
  return value;
}

function mediaRoot(dataRoot, projectId) {
  return path.join(dataRoot, "project-media", safeProjectId(projectId));
}

function cleanBaseName(value) {
  const ext = path.extname(value);
  const base = path.basename(value, ext)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return base || "image";
}

function displayNameFromStored(storedName) {
  return storedName.replace(/^\d+-[a-f0-9]{8}-/, "");
}

export async function listReferenceImages(dataRoot, projectId) {
  const dir = mediaRoot(dataRoot, projectId);
  let names = [];

  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }

  const items = [];
  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const filePath = path.join(dir, name);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      items.push({
        id: name,
        displayName: displayNameFromStored(name),
        filePath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    } catch {
      // Ignore files that disappear while reading.
    }
  }

  return items
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_REFERENCE_IMAGES);
}

export async function addReferenceImages(dataRoot, projectId, sourcePaths) {
  const dir = mediaRoot(dataRoot, projectId);
  await fs.mkdir(dir, { recursive: true });

  const existing = await listReferenceImages(dataRoot, projectId);
  const remaining = Math.max(0, MAX_REFERENCE_IMAGES - existing.length);
  const accepted = [];
  const skipped = [];

  for (const sourcePath of Array.isArray(sourcePaths) ? sourcePaths.slice(0, remaining) : []) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      skipped.push(path.basename(sourcePath));
      continue;
    }

    try {
      const stat = await fs.stat(sourcePath);
      if (!stat.isFile() || stat.size > MAX_REFERENCE_IMAGE_BYTES) {
        skipped.push(path.basename(sourcePath));
        continue;
      }

      const safeBase = cleanBaseName(sourcePath);
      const storedName =
        Date.now() + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8) + "-" + safeBase + ext;
      const target = path.join(dir, storedName);
      await fs.copyFile(sourcePath, target);
      accepted.push(storedName);
    } catch {
      skipped.push(path.basename(sourcePath));
    }
  }

  return {
    accepted,
    skipped,
    images: await listReferenceImages(dataRoot, projectId)
  };
}

export async function removeReferenceImage(dataRoot, projectId, imageId) {
  const filePath = path.join(mediaRoot(dataRoot, projectId), safeImageId(imageId));
  await fs.rm(filePath, { force: true });
}

export function referenceImagePath(dataRoot, projectId, imageId) {
  return path.join(mediaRoot(dataRoot, projectId), safeImageId(imageId));
}

export async function copyReferenceImages(dataRoot, projectId, destinationRoot) {
  const images = await listReferenceImages(dataRoot, projectId);
  if (!images.length) return [];

  const targetDir = path.join(destinationRoot, "reference-images");
  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  const usedNames = new Set();

  for (const image of images) {
    const ext = path.extname(image.displayName);
    const base = path.basename(image.displayName, ext);
    let exportName = image.displayName;
    let suffix = 2;

    while (usedNames.has(exportName.toLowerCase())) {
      exportName = base + "-" + suffix + ext;
      suffix += 1;
    }

    usedNames.add(exportName.toLowerCase());
    const target = path.join(targetDir, exportName);
    await fs.copyFile(image.filePath, target);
    copied.push(path.join("reference-images", exportName).replace(/\\/g, "/"));
  }

  return copied;
}
