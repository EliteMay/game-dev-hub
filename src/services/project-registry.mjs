import fs from "node:fs/promises";
import path from "node:path";
import {
  createProjectRecord,
  DEFAULT_PROJECT,
  isLocalPrototypeProject,
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

  const sameId = registry.projects.find((item) => item.id === project.id);
  if (sameId) {
    throw new Error("同じGame IDがすでに登録されています。");
  }

  const sameLocalPath = registry.projects.find(
    (item) => path.resolve(item.localPath).toLowerCase() === path.resolve(project.localPath).toLowerCase()
  );
  if (sameLocalPath) {
    throw new Error("同じ保存先がすでにHubへ登録されています。");
  }

  if (!isLocalPrototypeProject(project)) {
    const sameRemote = registry.projects.find(
      (item) =>
        !isLocalPrototypeProject(item) &&
        item.repositoryWebUrl.toLowerCase() === project.repositoryWebUrl.toLowerCase()
    );

    if (sameRemote) {
      throw new Error("このRepositoryはすでに登録されています。");
    }
  }

  const next = {
    version: REGISTRY_VERSION,
    projects: [...registry.projects, project]
  };

  await saveProjects(userDataPath, next);
  return project;
}

export async function replaceProject(userDataPath, projectsRoot, projectId, record) {
  const registry = await loadProjects(userDataPath, projectsRoot);
  const index = registry.projects.findIndex((item) => item.id === projectId);
  if (index < 0) {
    throw new Error("対象Gameが見つかりません。");
  }

  const project = createProjectRecord({ ...record, id: projectId });
  const nextProjects = registry.projects.map((item, itemIndex) =>
    itemIndex === index ? project : item
  );

  await saveProjects(userDataPath, {
    version: REGISTRY_VERSION,
    projects: nextProjects
  });
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
