import fs from "node:fs/promises";
import path from "node:path";

const MAX_BRIDGE_FILE_BYTES = 512 * 1024;
const MAX_FOUNDATION_DIAGNOSTICS_BYTES = 128 * 1024;

function safeProjectId(value) {
  const id = String(value ?? "");
  if (!/^[a-z0-9-]{1,100}$/.test(id)) {
    throw new Error("Game IDが正しくありません。");
  }
  return id;
}

function safeRunId(value) {
  const id = String(value ?? "");
  if (!/^[0-9TZ._-]{10,80}$/.test(id)) {
    throw new Error("Test Run IDが正しくありません。");
  }
  return id;
}

function unavailable(reason, extra = {}) {
  return {
    available: false,
    reason,
    ...extra
  };
}

function previousSessionEvidence(payload) {
  const source = payload?.runtime?.previous_session;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {
      marker_found: false,
      possible_unclean_exit: false,
      reason: "unavailable"
    };
  }

  const result = {
    marker_found: source.marker_found === true,
    possible_unclean_exit: source.possible_unclean_exit === true,
    reason: String(source.reason || "").slice(0, 256)
  };
  if (Object.hasOwn(source, "marker_valid")) {
    result.marker_valid = source.marker_valid === true;
  }
  if (Number.isFinite(Number(source.previous_started_at_unix))) {
    result.previous_started_at_unix = Number(source.previous_started_at_unix);
  }
  if (Object.hasOwn(source, "app_version")) {
    result.app_version = String(source.app_version || "").slice(0, 128);
  }
  if (Object.hasOwn(source, "foundation_version")) {
    result.foundation_version = String(source.foundation_version || "").slice(0, 128);
  }
  return result;
}

export function validateFoundationDiagnosticsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return unavailable("payload_missing");
  }
  if (Number(payload.schemaVersion) !== 1) {
    return unavailable("unsupported_diagnostics_schema");
  }
  if (payload.source !== "godot-game-foundation") {
    return unavailable("unexpected_diagnostics_source");
  }

  const handoff = payload.handoff;
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
    return unavailable("handoff_metadata_missing");
  }
  if (
    handoff.sanitized !== true ||
    handoff.remote_eligible !== true ||
    handoff.contains_binary !== false ||
    handoff.known_sensitive_fields_redacted !== true ||
    handoff.home_paths_redacted !== true
  ) {
    return unavailable("handoff_not_share_safe");
  }

  const serialized = JSON.stringify(payload);
  const actualBytes = Buffer.byteLength(serialized, "utf8");
  if (actualBytes > MAX_FOUNDATION_DIAGNOSTICS_BYTES) {
    return unavailable("diagnostics_payload_too_large", { actualBytes });
  }

  const declaredMax = Number(handoff.max_payload_bytes || 0);
  const declaredBytes = Number(handoff.payload_bytes || 0);
  if (
    !Number.isFinite(declaredMax) ||
    declaredMax < 1 ||
    declaredMax > MAX_FOUNDATION_DIAGNOSTICS_BYTES ||
    !Number.isFinite(declaredBytes) ||
    declaredBytes < 1 ||
    declaredBytes > declaredMax
  ) {
    return unavailable("diagnostics_size_metadata_invalid", { actualBytes });
  }

  return {
    available: true,
    payload,
    actualBytes,
    previousSession: previousSessionEvidence(payload)
  };
}

export function extractFoundationDiagnosticsHandoff(
  envelope,
  report,
  repositoryCommit = ""
) {
  if (!report || typeof report !== "object") {
    return unavailable("runtime_bridge_report_missing");
  }
  if (report.engine !== "Runtime Test Bridge") {
    return unavailable("runtime_bridge_report_required");
  }

  const projectId = safeProjectId(report.projectId);
  const runId = safeRunId(report.testRunId);
  const expectedSession = projectId + "-" + runId;

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return unavailable("runtime_bridge_envelope_missing", { testRunId: runId });
  }
  if (Number(envelope.schemaVersion) !== 2) {
    return unavailable("runtime_bridge_diagnostics_unavailable", { testRunId: runId });
  }
  if (String(envelope.sessionId || "") !== expectedSession) {
    return unavailable("runtime_bridge_session_mismatch", { testRunId: runId });
  }

  const reportCommit = String(report.gitCommit || "");
  const currentCommit = String(repositoryCommit || "");
  if (reportCommit && currentCommit && reportCommit !== currentCommit) {
    return unavailable("repository_commit_changed", {
      testRunId: runId,
      reportCommit,
      repositoryCommit: currentCommit
    });
  }

  const validated = validateFoundationDiagnosticsPayload(
    envelope.foundationDiagnostics
  );
  if (!validated.available) {
    return {
      ...validated,
      testRunId: runId
    };
  }

  const capturedAtUnixMs = Number(envelope.capturedAtUnixMs || 0);
  const capturedAt = Number.isFinite(capturedAtUnixMs) && capturedAtUnixMs > 0
    ? new Date(capturedAtUnixMs).toISOString()
    : "";

  return {
    available: true,
    source: "runtime-test-bridge",
    testRunId: runId,
    capturedAt,
    bridge: {
      schemaVersion: 2,
      sequence: Number(envelope.sequence || 0),
      sessionMatched: true
    },
    repository: {
      reportCommit,
      currentCommit,
      commitMatched: reportCommit && currentCommit
        ? reportCommit === currentCommit
        : null
    },
    previousSession: validated.previousSession,
    payload: validated.payload
  };
}

export async function loadFoundationDiagnosticsHandoff({
  dataRoot,
  projectId,
  report,
  repositoryCommit = ""
}) {
  if (!report) return unavailable("runtime_bridge_report_missing");

  const safeProject = safeProjectId(projectId);
  if (safeProject !== safeProjectId(report.projectId)) {
    return unavailable("runtime_bridge_project_mismatch");
  }
  const runId = safeRunId(report.testRunId);
  const statePath = path.join(
    dataRoot,
    "ai-testing",
    "runs",
    safeProject,
    runId,
    "runtime-bridge",
    "state.json"
  );

  let stat;
  try {
    stat = await fs.stat(statePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return unavailable("runtime_bridge_state_missing", { testRunId: runId });
    }
    return unavailable("runtime_bridge_state_unreadable", { testRunId: runId });
  }

  if (!stat.isFile() || stat.size < 2 || stat.size > MAX_BRIDGE_FILE_BYTES) {
    return unavailable("runtime_bridge_state_size_invalid", {
      testRunId: runId,
      bytes: stat.size
    });
  }

  try {
    const envelope = JSON.parse(await fs.readFile(statePath, "utf8"));
    return extractFoundationDiagnosticsHandoff(
      envelope,
      report,
      repositoryCommit
    );
  } catch {
    return unavailable("runtime_bridge_state_invalid", { testRunId: runId });
  }
}
