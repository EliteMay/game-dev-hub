import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRuntimeBridgeLaunchArgs,
  evaluateMouseLook,
  evaluateMovement,
  parseRuntimeSnapshot,
  planarDistance,
  shortestAngleDelta
} from "../src/services/runtime-testing.mjs";

test("Runtime Test Bridge launch args preserve engine args and add one user-arg separator", () => {
  const result = buildRuntimeBridgeLaunchArgs(
    ["--path", "C:/Games/deep-factory"],
    "C:/App Data/runtime/state.json",
    "session-1"
  );
  assert.deepEqual(result, [
    "--path",
    "C:/Games/deep-factory",
    "--",
    "--foundation-test-state=C:/App Data/runtime/state.json",
    "--foundation-test-session=session-1"
  ]);

  const existingSeparator = buildRuntimeBridgeLaunchArgs(
    ["--path", "C:/Games/deep-factory", "--", "--custom=1"],
    "C:/state.json",
    "session-2"
  );
  assert.equal(existingSeparator.filter((item) => item === "--").length, 1);
});

test("Runtime Test Bridge snapshot validates schema, session and state", () => {
  const parsed = parseRuntimeSnapshot({
    schemaVersion: 1,
    sessionId: "abc",
    sequence: 4,
    state: { ready: true, player: { position: [0, 0, 0] } }
  }, "abc");
  assert.equal(parsed.sequence, 4);
  assert.equal(parsed.state.ready, true);

  assert.throws(
    () => parseRuntimeSnapshot({
      schemaVersion: 1,
      sessionId: "stale",
      sequence: 1,
      state: {}
    }, "current"),
    /SESSION_MISMATCH/
  );
});

test("movement verdict uses internal XZ position instead of screenshot differences", () => {
  assert.equal(planarDistance([0, 1, 0], [0.1, 1, 0.2]).toFixed(3), "0.224");
  const pass = evaluateMovement(
    { player: { position: [0, 1, 0] } },
    { player: { position: [0, 1, -0.4] } }
  );
  assert.equal(pass.status, "PASS");
  assert.equal(pass.confidence, "high");

  const fail = evaluateMovement(
    { player: { position: [0, 1, 0] } },
    { player: { position: [0.001, 1, 0.001] } }
  );
  assert.equal(fail.status, "FAIL");
});

test("mouse-look verdict handles yaw wrap-around and compares runtime camera angles", () => {
  const wrapped = shortestAngleDelta(Math.PI - 0.01, -Math.PI + 0.02);
  assert.ok(wrapped < 0.04);

  const pass = evaluateMouseLook(
    { player: { yaw: 0, pitch: 0 } },
    { player: { yaw: 0.2, pitch: 0 } }
  );
  assert.equal(pass.status, "PASS");

  const unknown = evaluateMouseLook(
    { player: { yaw: null, pitch: 0 } },
    { player: { yaw: 0.2, pitch: 0 } }
  );
  assert.equal(unknown.status, "UNKNOWN");
});
