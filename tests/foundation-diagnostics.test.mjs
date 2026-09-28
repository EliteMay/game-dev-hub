import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  extractFoundationDiagnosticsHandoff,
  loadFoundationDiagnosticsHandoff,
  validateFoundationDiagnosticsPayload
} from "../src/services/foundation-diagnostics.mjs";

const PROJECT_ID = "deep-factory";
const RUN_ID = "20260929T030000Z";
const COMMIT = "0123456789abcdef";

function diagnosticsPayload() {
  return {
    schemaVersion: 1,
    source: "godot-game-foundation",
    capture: {
      timestamp_unix: 1790000000,
      reason: "game_dev_hub_runtime_test"
    },
    runtime: {
      initialized: true,
      runtime_test_mode: true,
      previous_session: {
        marker_found: true,
        marker_valid: true,
        possible_unclean_exit: true,
        reason: "active_marker_present",
        previous_started_at_unix: 1789999900,
        app_version: "0.1.0",
        foundation_version: "0.16.0-dev"
      }
    },
    paths: {
      save: "user://save.json"
    },
    errors: {
      info_count: 0,
      warning_count: 0,
      error_count: 0,
      recent_errors: []
    },
    recent_entries: [],
    performance: { fps: 60 },
    handoff: {
      sanitized: true,
      remote_eligible: true,
      contains_binary: false,
      known_sensitive_fields_redacted: true,
      home_paths_redacted: true,
      max_payload_bytes: 131072,
      payload_bytes: 1024,
      trimmed_for_size: false
    }
  };
}

function report() {
  return {
    projectId: PROJECT_ID,
    testRunId: RUN_ID,
    engine: "Runtime Test Bridge",
    gitCommit: COMMIT
  };
}

function envelope() {
  return {
    schemaVersion: 2,
    sessionId: PROJECT_ID + "-" + RUN_ID,
    sequence: 9,
    capturedAtUnixMs: 1790000000123,
    state: {
      ready: true,
      player: { position: [1, 2, 3] }
    },
    foundationDiagnostics: diagnosticsPayload()
  };
}

test("sanitized Foundation diagnostics are accepted without copying game telemetry", () => {
  const result = extractFoundationDiagnosticsHandoff(
    envelope(),
    report(),
    COMMIT
  );

  assert.equal(result.available, true);
  assert.equal(result.source, "runtime-test-bridge");
  assert.equal(result.bridge.schemaVersion, 2);
  assert.equal(result.repository.commitMatched, true);
  assert.equal(result.previousSession.possible_unclean_exit, true);
  assert.equal(result.previousSession.reason, "active_marker_present");
  assert.equal(result.payload.source, "godot-game-foundation");
  assert.equal(Object.hasOwn(result, "state"), false);
  assert.equal(JSON.stringify(result).includes('"player"'), false);
});

test("share consumer rejects diagnostics that do not declare the Foundation privacy boundary", () => {
  const unsafe = diagnosticsPayload();
  unsafe.handoff.sanitized = false;

  const result = validateFoundationDiagnosticsPayload(unsafe);
  assert.equal(result.available, false);
  assert.equal(result.reason, "handoff_not_share_safe");
});

test("share consumer rejects runtime evidence from a different repository commit", () => {
  const result = extractFoundationDiagnosticsHandoff(
    envelope(),
    report(),
    "different-commit"
  );

  assert.equal(result.available, false);
  assert.equal(result.reason, "repository_commit_changed");
});

test("latest runtime bridge state can be loaded from the app-data run directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-foundation-diag-"));
  const stateDir = path.join(
    root,
    "ai-testing",
    "runs",
    PROJECT_ID,
    RUN_ID,
    "runtime-bridge"
  );
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    path.join(stateDir, "state.json"),
    JSON.stringify(envelope()),
    "utf8"
  );

  const result = await loadFoundationDiagnosticsHandoff({
    dataRoot: root,
    projectId: PROJECT_ID,
    report: report(),
    repositoryCommit: COMMIT
  });

  assert.equal(result.available, true);
  assert.equal(result.testRunId, RUN_ID);
  assert.match(result.capturedAt, /^2026-/);

  await fs.rm(root, { recursive: true, force: true });
});

test("bridge schema v1 stays supported for fixed tests but is not treated as diagnostics handoff", () => {
  const legacy = envelope();
  legacy.schemaVersion = 1;
  delete legacy.foundationDiagnostics;

  const result = extractFoundationDiagnosticsHandoff(
    legacy,
    report(),
    COMMIT
  );

  assert.equal(result.available, false);
  assert.equal(result.reason, "runtime_bridge_diagnostics_unavailable");
});
