import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import {
  inspectWebProject,
  safeLoopbackUrl,
  waitForLoopbackServer
} from "../src/services/web-project.mjs";

test("web project metadata only accepts loopback development URLs", () => {
  assert.equal(safeLoopbackUrl("http://127.0.0.1:4173"), "http://127.0.0.1:4173/");
  assert.equal(safeLoopbackUrl("http://localhost:3000/play"), "http://localhost:3000/play");
  assert.equal(safeLoopbackUrl("http://[::1]:4173"), "http://[::1]:4173/");
  assert.equal(safeLoopbackUrl("https://example.com"), "");
  assert.equal(safeLoopbackUrl("javascript:alert(1)"), "");
});

test("web project inspection reads dev script and safe Hub metadata", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "game-dev-hub-web-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "skin-aim-trainer",
      scripts: { dev: "node scripts/dev-server.mjs" }
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(root, "game-dev-hub.json"),
    JSON.stringify({
      schemaVersion: 1,
      engine: "web",
      development: { url: "http://127.0.0.1:4173" }
    }),
    "utf8"
  );

  const info = await inspectWebProject(root);
  assert.equal(info.devScript, "dev");
  assert.equal(info.devUrl, "http://127.0.0.1:4173/");
  assert.equal(info.packageName, "skin-aim-trainer");
});

test("web launch readiness probe succeeds only after loopback server is listening", async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ready");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  assert.ok(address && typeof address === "object");

  await assert.doesNotReject(() =>
    waitForLoopbackServer(`http://127.0.0.1:${address.port}`, {
      timeoutMs: 1_000,
      intervalMs: 25,
      connectTimeoutMs: 100
    })
  );
});

test("web launch readiness probe rejects non-loopback URLs", async () => {
  await assert.rejects(
    waitForLoopbackServer("https://example.com", { timeoutMs: 500 }),
    (error) => error?.code === "WEB_DEV_URL_INVALID"
  );
});
