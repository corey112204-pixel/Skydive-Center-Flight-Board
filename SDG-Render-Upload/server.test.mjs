import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const testDir = mkdtempSync(join(tmpdir(), "sdg-api-"));
process.env.SDG_DB_PATH = join(testDir, "test.sqlite");
const { handler, db } = await import(`./server.mjs?test=${Date.now()}`);
let server, base;
const tokens = {};
test.before(async () => {
  server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password) => {
    const r = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  };
  tokens.administrator = (
    await login("corey@sdgops.com", "ChangeMe123!")
  ).token;
  for (const [role, email, pilotId] of [
    ["pilot", "pilot@test.local", "p1"],
    ["maintenance", "mx@test.local", null],
  ]) {
    await call("/users", "POST", {
      name: `${role} test`,
      email,
      role,
      pilot_id: pilotId,
      password: "Testing123!",
    });
    tokens[role] = (await login(email, "Testing123!")).token;
  }
});
test.after(() => {
  server.close();
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});
async function call(path, method = "GET", data, role = "administrator") {
  const r = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
test("pilot CRUD persists and audits", async () => {
  const email = `test-${Date.now()}@sdg.local`;
  const c = await call("/pilots", "POST", {
    name: "Test Pilot",
    email,
    phone: "555-0100",
    home: "Georgia",
    status: "Available",
    qual: "Current",
    until_text: "Current",
    active: 1,
  });
  assert.equal(c.status, 201);
  const u = await call(`/pilots/${c.data.id}`, "PUT", { phone: "555-0199" });
  assert.equal(u.data.phone, "555-0199");
  const state = await call("/state");
  assert(
    state.data.pilots.some((x) => x.id === c.data.id && x.phone === "555-0199"),
  );
  assert(state.data.audit_logs.some((x) => x.entity_id === c.data.id));
  await call(`/pilots/${c.data.id}`, "DELETE");
});
test("administrator creates accounts and disabled accounts cannot sign in", async () => {
  const email = `disabled-${Date.now()}@sdg.local`;
  const made = await call("/users", "POST", {
    name: "Disabled User",
    email,
    role: "drop_zone_manager",
    password: "Temporary123!",
  });
  assert.equal(made.status, 201);
  assert.equal(made.data.password_hash, undefined);
  const disabled = await call(`/users/${made.data.id}`, "PUT", { active: 0 });
  assert.equal(disabled.status, 200);
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Temporary123!" }),
  });
  assert.equal(login.status, 401);
});
test("authorization rejects pilot maintenance writes", async () => {
  const r = await call(
    "/maintenance",
    "POST",
    {
      aircraft_id: "a1",
      item: "Test",
      due: "10 hr",
      remaining: 10,
      warning: 5,
      status: "OK",
    },
    "pilot",
  );
  assert.equal(r.status, 403);
});
test("pilot state only includes pilot-facing operational data", async () => {
  const state = await call("/state", "GET", undefined, "pilot");
  assert.equal(state.status, 200);
  assert.equal(state.data.maintenance, undefined);
  assert.equal(state.data.squawks, undefined);
  assert.equal(state.data.audit_logs, undefined);
  assert(state.data.flight_records.every((record) => record.pilot_id === "p1"));
  assert.equal(state.data.pilots[0].email, undefined);
});
test("notification read status is stored per account", async () => {
  const request = await call(
    "/timeoff",
    "POST",
    {
      pilot_id: "p1",
      start_date: "2026-10-01",
      end_date: "2026-10-01",
      reason: "Personal",
      notes: "",
      status: "Pending",
      created_at: new Date().toISOString(),
    },
    "pilot",
  );
  assert.equal(request.status, 201);
  const before = await call("/state", "GET", undefined, "pilot");
  const notification = before.data.notifications.find(
    (x) => x.title === "timeoff created" && !x.read_at,
  );
  assert(notification);
  const adminState = await call("/state", "GET", undefined, "maintenance");
  assert.equal(
    adminState.data.notifications.find((x) => x.id === notification.id),
    undefined,
  );
  const read = await call(
    `/notifications/${notification.id}/read`,
    "POST",
    undefined,
    "pilot",
  );
  assert.equal(read.status, 200);
  const after = await call("/state", "GET", undefined, "pilot");
  assert(
    after.data.notifications.find((x) => x.id === notification.id).read_at,
  );
});
test("only pilots create squawks and maintenance updates them", async () => {
  const denied = await call(
    "/squawks",
    "POST",
    {
      aircraft_id: "a1",
      pilot_id: "p1",
      dz: "Georgia",
      description: "Denied",
      severity: "Monitor",
    },
    "maintenance",
  );
  assert.equal(denied.status, 403);
  const made = await call(
    "/squawks",
    "POST",
    {
      aircraft_id: "a1",
      pilot_id: "p1",
      dz: "Georgia",
      description: `Permission test ${Date.now()}`,
      severity: "Monitor",
      created_at: new Date().toISOString(),
    },
    "pilot",
  );
  assert.equal(made.status, 201);
  const deniedUpdate = await call(
    `/squawks/${made.data.id}`,
    "PUT",
    { status: "Closed" },
    "pilot",
  );
  assert.equal(deniedUpdate.status, 403);
  const updated = await call(
    `/squawks/${made.data.id}`,
    "PUT",
    { status: "Closed", corrective_action: "Inspected" },
    "maintenance",
  );
  assert.equal(updated.status, 200);
});
test("daily transaction updates aircraft", async () => {
  const before = db
    .prepare("select time from aircraft where id='a1'")
    .get().time;
  const r = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a1",
      pilot_id: "p1",
      dz: "Georgia",
      flight_date: "2026-09-03",
      start_time: before,
      end_time: before + 0.5,
      loads: 2,
      start_cycles: 8439,
      end_cycles: 8441,
    },
    "pilot",
  );
  assert.equal(r.status, 201);
  assert.equal(
    db.prepare("select time from aircraft where id='a1'").get().time,
    before + 0.5,
  );
  const beforeEdit = db.prepare("select * from aircraft where id='a1'").get();
  const editSquawk = `Edit squawk ${Date.now()}`;
  const edited = await call(
    `/flight_records/${r.data.id}`,
    "PUT",
    {
      end_time: before + 0.8,
      end_cycles: 8442,
      loads: 3,
      notes: "Corrected after reviewing load sheet",
      squawk_description: editSquawk,
    },
    "pilot",
  );
  assert.equal(edited.status, 200);
  assert.equal(edited.data.total_time, 0.8);
  assert.equal(edited.data.loads, 3);
  const afterEdit = db.prepare("select * from aircraft where id='a1'").get();
  assert.equal(afterEdit.time, beforeEdit.time + 0.3);
  assert.equal(afterEdit.cycles, beforeEdit.cycles + 1);
  assert(
    db
      .prepare("select id from flight_revisions where record_id=?")
      .get(r.data.id),
  );
  assert.equal(
    db
      .prepare("select severity from squawks where description=?")
      .get(editSquawk).severity,
    "Information",
  );
});
test("daily record can atomically create a squawk", async () => {
  const ac = db.prepare("select * from aircraft where id='a2'").get(),
    description = `Linked squawk ${Date.now()}`;
  const r = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a2",
      pilot_id: "p1",
      dz: "Alabama",
      flight_date: "2026-09-04",
      start_time: ac.time,
      end_time: ac.time + 0.2,
      loads: 1,
      start_cycles: ac.cycles,
      end_cycles: ac.cycles + 1,
      squawk_description: description,
      squawk_severity: "Monitor",
    },
    "pilot",
  );
  assert.equal(r.status, 201);
  assert(
    db.prepare("select id from squawks where description=?").get(description),
  );
});
