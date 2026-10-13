import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testDir = mkdtempSync(join(tmpdir(), "sdg-web-"));
process.env.NODE_ENV = "production";
process.env.SDG_DB_PATH = join(testDir, "data", "operations.sqlite");
process.env.SDG_INITIAL_ADMIN_PASSWORD = "Test-Admin-Password-123";
const { webHandler } = await import(`./web-server.mjs?test=${Date.now()}`);
const { db } = await import("./server.mjs");
const server = createServer((req, res) => {
  void webHandler(req, res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

test("production web server serves built site, API, and health check", async () => {
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /\/assets\/index-/);
  assert.match(home.headers.get("content-type"), /text\/html/);

  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "ok");

  const unauthorized = await fetch(base + "/api/state");
  assert.equal(unauthorized.status, 401);
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "corey@sdgops.com",
      password: process.env.SDG_INITIAL_ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const state = await fetch(base + "/api/state", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(state.status, 200);
  const data = await state.json();
  assert.equal(data.pilots.length, 1);
  assert.equal(data.schedules.length, 0);
  assert.equal(data.aircraft.length, 3);

  const manifest = await fetch(base + "/manifest.webmanifest");
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get("content-type"), /application\/manifest\+json/);
  assert.equal((await manifest.json()).display, "standalone");
  assert.equal((await fetch(base + "/sw.js")).status, 200);

  const pushKey = await fetch(base + "/api/push/public-key", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(pushKey.status, 200);
  assert.match((await pushKey.json()).public_key, /^[A-Za-z0-9_-]+$/);

  const subscribe = await fetch(base + "/api/push/subscribe", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      subscription: {
        endpoint: "https://push.example.test/device-1",
        keys: { p256dh: "test-key", auth: "test-auth" },
      },
    }),
  });
  assert.equal(subscribe.status, 201);
  const pushStatus = await fetch(base + "/api/push/status", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.deepEqual(await pushStatus.json(), { enabled: true, devices: 1 });
});

test("production web server does not expose source or database files", async () => {
  assert.equal((await fetch(base + "/server.mjs")).status, 404);
  assert.equal((await fetch(base + "/work/sdg-operations.sqlite")).status, 404);
});
