import crypto from "node:crypto";
import path from "node:path";

import { readJsonRecovering, writeJsonAtomic } from "./storage.mjs";

const VERIFICATION_VERSION = 1;
const ALLOWED_STATUSES = new Set(["pending", "passed", "failed", "blocked"]);

function verificationPath(userDataPath, projectId) {
  return path.join(userDataPath, "task-verifications", projectId + ".json");
}

function cleanText(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim().slice(0, maxLength)
    : "";
}

export function taskVerificationSignature(task) {
  const payload = {
    section: cleanText(task?.section, 240),
    text: cleanText(task?.text, 500),
    owner: cleanText(task?.owner, 40),
    steps: Array.isArray(task?.steps)
      ? task.steps.map((step) => cleanText(step, 800))
      : [],
    completionCriteria: cleanText(task?.completionCriteria, 1200)
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

function expectedSteps(task) {
  const steps = Array.isArray(task?.steps)
    ? task.steps.map((step) => cleanText(step, 800)).filter(Boolean)
    : [];

  return steps.length ? steps : [cleanText(task?.text, 500) || "タスク全体"];
}

function normalizeStatus(value) {
  return ALLOWED_STATUSES.has(value) ? value : "pending";
}

function overallStatus(steps) {
  const statuses = steps.map((step) => step.status);

  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.length > 0 && statuses.every((status) => status === "passed")) return "passed";
  if (statuses.some((status) => status !== "pending")) return "in-progress";
  return "untested";
}

function normalizeRecord(raw, task) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const stepTexts = expectedSteps(task);
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps = stepTexts.map((text, index) => ({
    text,
    status: normalizeStatus(rawSteps[index]?.status)
  }));

  const signature = taskVerificationSignature(task);
  const stale = raw.signature !== signature;

  return {
    taskId: String(task?.id || ""),
    signature,
    stale,
    overall: stale ? "stale" : overallStatus(steps),
    steps,
    note: cleanText(raw.note, 2000),
    repositoryCommit: cleanText(raw.repositoryCommit, 80),
    repositoryBranch: cleanText(raw.repositoryBranch, 120),
    godotVersion: cleanText(raw.godotVersion, 240),
    appVersion: cleanText(raw.appVersion, 80),
    updatedAt: cleanText(raw.updatedAt, 80)
  };
}

async function loadFile(userDataPath, projectId) {
  const filePath = verificationPath(userDataPath, projectId);
  const loaded = await readJsonRecovering(filePath, {
    version: VERIFICATION_VERSION,
    records: {}
  });

  const raw = loaded.value;
  return {
    version: VERIFICATION_VERSION,
    records: raw && typeof raw.records === "object" && !Array.isArray(raw.records)
      ? raw.records
      : {}
  };
}

export async function loadTaskVerifications(userDataPath, projectId, tasks) {
  const file = await loadFile(userDataPath, projectId);
  const result = {};

  for (const section of tasks?.sections || []) {
    for (const task of section.tasks || []) {
      const record = normalizeRecord(file.records[task.id], {
        ...task,
        section: section.title,
        completionCriteria: section.completionCriteria || ""
      });

      if (record) result[task.id] = record;
    }
  }

  return result;
}

export async function saveTaskVerification(userDataPath, projectId, task, input = {}, context = {}) {
  const filePath = verificationPath(userDataPath, projectId);
  const file = await loadFile(userDataPath, projectId);
  const stepTexts = expectedSteps(task);
  const inputSteps = Array.isArray(input.steps) ? input.steps : [];

  const steps = stepTexts.map((text, index) => ({
    text,
    status: normalizeStatus(inputSteps[index]?.status)
  }));

  const record = {
    taskId: task.id,
    signature: taskVerificationSignature(task),
    steps,
    note: cleanText(input.note, 2000),
    repositoryCommit: cleanText(context.repositoryCommit, 80),
    repositoryBranch: cleanText(context.repositoryBranch, 120),
    godotVersion: cleanText(context.godotVersion, 240),
    appVersion: cleanText(context.appVersion, 80),
    updatedAt: new Date().toISOString()
  };

  await writeJsonAtomic(filePath, {
    version: VERIFICATION_VERSION,
    records: {
      ...file.records,
      [task.id]: record
    }
  });

  return normalizeRecord(record, task);
}

export async function clearTaskVerification(userDataPath, projectId, taskId) {
  const filePath = verificationPath(userDataPath, projectId);
  const file = await loadFile(userDataPath, projectId);
  const records = { ...file.records };
  delete records[taskId];

  await writeJsonAtomic(filePath, {
    version: VERIFICATION_VERSION,
    records
  });
}
