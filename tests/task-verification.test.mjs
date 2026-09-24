import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  clearTaskVerification,
  loadTaskVerifications,
  saveTaskVerification,
  taskVerificationSignature
} from "../src/services/task-verification.mjs";

function task(overrides = {}) {
  return {
    id: "task-1",
    section: "Phase 1",
    text: "Windows実機確認",
    owner: "user",
    steps: ["左右に視点が動く", "上下に視点が動く"],
    completionCriteria: "両方動く",
    done: false,
    ...overrides
  };
}

function tasksWith(currentTask) {
  return {
    sections: [
      {
        title: currentTask.section,
        completionCriteria: currentTask.completionCriteria,
        tasks: [currentTask]
      }
    ]
  };
}

test("manual verification persists per-step outcomes and context", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-verification-"));
  try {
    const currentTask = task();
    const saved = await saveTaskVerification(
      root,
      "deep-factory",
      currentTask,
      {
        steps: [{ status: "passed" }, { status: "failed" }],
        note: "上下だけ動かない"
      },
      {
        repositoryCommit: "abcdef12",
        repositoryBranch: "main",
        godotVersion: "4.7.2.stable",
        appVersion: "0.1.9"
      }
    );

    assert.equal(saved.overall, "failed");
    assert.equal(saved.steps[0].status, "passed");
    assert.equal(saved.steps[1].status, "failed");
    assert.equal(saved.note, "上下だけ動かない");
    assert.equal(saved.repositoryCommit, "abcdef12");
    assert.equal(saved.godotVersion, "4.7.2.stable");

    const loaded = await loadTaskVerifications(root, "deep-factory", tasksWith(currentTask));
    assert.equal(loaded[currentTask.id].overall, "failed");
    assert.equal(loaded[currentTask.id].stale, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("all passed steps roll up to passed", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-verification-"));
  try {
    const currentTask = task();
    const saved = await saveTaskVerification(
      root,
      "deep-factory",
      currentTask,
      { steps: [{ status: "passed" }, { status: "passed" }] }
    );

    assert.equal(saved.overall, "passed");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("verification becomes stale when roadmap instructions change", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-verification-"));
  try {
    const original = task();
    await saveTaskVerification(
      root,
      "deep-factory",
      original,
      { steps: [{ status: "passed" }, { status: "passed" }] }
    );

    const changed = task({
      steps: ["左右に視点が動く", "上下に視点が動く", "視点が裏返らない"]
    });
    const loaded = await loadTaskVerifications(root, "deep-factory", tasksWith(changed));

    assert.equal(loaded[changed.id].stale, true);
    assert.equal(loaded[changed.id].overall, "stale");
    assert.notEqual(taskVerificationSignature(original), taskVerificationSignature(changed));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("manual verification can be cleared without touching other app data", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-verification-"));
  try {
    const currentTask = task();
    await saveTaskVerification(
      root,
      "deep-factory",
      currentTask,
      { steps: [{ status: "passed" }, { status: "passed" }] }
    );

    await clearTaskVerification(root, "deep-factory", currentTask.id);
    const loaded = await loadTaskVerifications(root, "deep-factory", tasksWith(currentTask));
    assert.equal(loaded[currentTask.id], undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
