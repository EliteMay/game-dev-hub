import fs from "node:fs/promises";
import path from "node:path";
import {
  createProjectRecord,
  DEFAULT_PROJECT,
  normalizeRegistry,
  REGISTRY_VERSION
} from "../core/project-model.mjs";
import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

function registryPath(userDataPath) {
  return path.join(userDataPath, "projects.json");
}

export async function loadProjects(userDataPath, projectsRoot) {
  const filePath = registryPath(userDataPath);

  try {
    await fs.access(filePath);
  } catch {
    const seeded = {
      version: REGISTRY_VERSION,
      projects: [
        createProjectRecord({
          ...DEFAULT_PROJECT,
          localPath: path.join(projectsRoot, "deep-factory")
        })
      ]
    };
    await writeJsonAtomic(filePath, seeded);
    return seeded;
  }

  const loaded = await readJsonRecovering(filePath, { version: REGISTRY_VERSION, projects: [] });

  if (loaded.fallbackUsed) {
    const seeded = {
      version: REGISTRY_VERSION,
      projects: [
        createProjectRecord({
          ...DEFAULT_PROJECT,
          localPath: path.join(projectsRoot, "deep-factory")
        })
      ]
    };
    await writeJsonAtomic(filePath, seeded);
    return seeded;
  }

  const raw = loaded.value;
  const normalized = normalizeRegistry(raw);

  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    await writeJsonAtomic(filePath, normalized);
  }

  return normalized;
}

export async function saveProjects(userDataPath, registry) {
  const normalized = normalizeRegistry(registry);
  await writeJsonAtomic(registryPath(userDataPath), normalized);
  return normalized;
}

export async function addProject(userDataPath, projectsRoot, record) {
  const registry = await loadProjects(userDataPath, projectsRoot);
  const project = createProjectRecord(record);

  const sameRemote = registry.projects.find(
    (item) => item.repositoryWebUrl.toLowerCase() === project.repositoryWebUrl.toLowerCase()
  );

  if (sameRemote) {
    throw new Error("このRepositoryはすでに登録されています。");
  }

  const next = {
    version: REGISTRY_VERSION,
    projects: [...registry.projects, project]
  };

  await saveProjects(userDataPath, next);
  return project;
}

export async function removeProject(userDataPath, projectsRoot, projectId) {
  const registry = await loadProjects(userDataPath, projectsRoot);
  const nextProjects = registry.projects.filter((item) => item.id !== projectId);

  if (nextProjects.length === registry.projects.length) {
    throw new Error("対象Gameが見つかりません。");
  }

  await saveProjects(userDataPath, {
    version: REGISTRY_VERSION,
    projects: nextProjects
  });
}
