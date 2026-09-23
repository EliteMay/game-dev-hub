import test from "node:test";
import assert from "node:assert/strict";

import { isAllowedGodotBasename } from "../src/services/godot.mjs";

test("accepts common Godot executable names", () => {
  assert.equal(isAllowedGodotBasename("C:\\Tools\\Godot.exe"), true);
  assert.equal(isAllowedGodotBasename("C:\\Tools\\godot4.exe"), true);
  assert.equal(
    isAllowedGodotBasename("C:\\Tools\\Godot_v4.6-stable_win64.exe"),
    true
  );
});

test("rejects unrelated executable", () => {
  assert.equal(isAllowedGodotBasename("C:\\Windows\\System32\\cmd.exe"), false);
});
