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
test("maintenance frequency can be stored in calendar months", async () => {
  const created = await call(
    "/maintenance",
    "POST",
    {
      aircraft_id: "a1",
      item: "Annual inspection",
      due: "2030-10-01",
      remaining: 365,
      warning: 30,
      status: "OK",
      due_date: "2030-10-01",
      interval_months: 12,
    },
    "maintenance",
  );
  assert.equal(created.status, 201);
  assert.equal(
    db
      .prepare("select interval_months from maintenance where id=?")
      .get(created.data.id).interval_months,
    12,
  );
});
test("maintenance due time is calculated from aircraft TTSN", async () => {
  const aircraft = db.prepare("select * from aircraft where id='a1'").get();
  const dueTtsn = Number(aircraft.ttsn) + 10;
  const created = await call(
    "/maintenance",
    "POST",
    {
      aircraft_id: "a1",
      item: "TTSN based inspection",
      due: `${dueTtsn.toFixed(1)} TTSN`,
      remaining: 10,
      warning: 2,
      status: "OK",
      due_hours: dueTtsn,
      warning_hours: 2,
    },
    "maintenance",
  );
  assert.equal(created.status, 201);
  let state = await call("/state", "GET", undefined, "maintenance");
  let item = state.data.maintenance.find((entry) => entry.id === created.data.id);
  assert.equal(item.remaining_label, "10.0 hr TTSN");
  assert.equal(item.status, "OK");

  db.prepare("update aircraft set ttsn=? where id='a1'").run(dueTtsn - 1.5);
  state = await call("/state", "GET", undefined, "maintenance");
  item = state.data.maintenance.find((entry) => entry.id === created.data.id);
  assert.equal(item.remaining_label, "1.5 hr TTSN");
  assert.equal(item.status, "Due soon");
});
test("maintenance due time can be calculated from Hobbs", async () => {
  const aircraft = db.prepare("select * from aircraft where id='a2'").get();
  const dueHobbs = Number(aircraft.hobbs) + 3;
  const created = await call(
    "/maintenance",
    "POST",
    {
      aircraft_id: "a2",
      item: "Hobbs based service",
      due: `${dueHobbs.toFixed(1)} Hobbs`,
      remaining: 3,
      warning: 1,
      status: "OK",
      due_time_basis: "hobbs",
      due_hours: dueHobbs,
      warning_hours: 1,
    },
    "maintenance",
  );
  assert.equal(created.status, 201);
  let state = await call("/state", "GET", undefined, "maintenance");
  let item = state.data.maintenance.find((entry) => entry.id === created.data.id);
  assert.equal(item.remaining_label, "3.0 hr Hobbs");

  db.prepare("update aircraft set hobbs=?,time=? where id='a2'").run(
    dueHobbs - 0.5,
    dueHobbs - 0.5,
  );
  state = await call("/state", "GET", undefined, "maintenance");
  item = state.data.maintenance.find((entry) => entry.id === created.data.id);
  assert.equal(item.remaining_label, "0.5 hr Hobbs");
  assert.equal(item.status, "Due soon");
});
test("PAC engine maintenance can use engine hour and cycle counters", async () => {
  db.prepare(
    `update aircraft set engine_ttsn=5000,engine_tcsn=4200,
     engine_ttsoh=400,engine_tcsoh=300 where id='a1'`,
  ).run();
  const created = await call(
    "/maintenance",
    "POST",
    {
      aircraft_id: "a1",
      item: "Engine hot section inspection",
      component: "engine",
      due: "410.0 Engine TTSOH or 305 Engine TCSOH",
      remaining: 5,
      warning: 6,
      status: "OK",
      due_time_basis: "engine_ttsoh",
      due_hours: 410,
      due_cycle_basis: "engine_tcsoh",
      due_cycles: 305,
      warning_cycles: 6,
    },
    "maintenance",
  );
  assert.equal(created.status, 201);
  const state = await call("/state", "GET", undefined, "maintenance");
  const item = state.data.maintenance.find((entry) => entry.id === created.data.id);
  assert.equal(item.component, "engine");
  assert.equal(item.remaining_label, "10.0 hr Engine TTSOH / 5 cycles Engine TCSOH");
  assert.equal(item.status, "Due soon");
});
test("maintenance can reserve an aircraft but cannot schedule pilots", async () => {
  const date = "2030-04-12";
  const mx = await call(
    "/schedules",
    "POST",
    {
      kind: "maintenance",
      pilot_id: null,
      aircraft_id: "a3",
      dz: "Tennessee",
      start_at: `${date}T00:00`,
      end_at: `${date}T23:59`,
      status: "Scheduled",
      notes: "Inspection",
    },
    "maintenance",
  );
  assert.equal(mx.status, 201);
  const pilot = await call(
    "/schedules",
    "POST",
    {
      kind: "pilot",
      pilot_id: "p1",
      aircraft_id: "a2",
      dz: "Alabama",
      start_at: `${date}T00:00`,
      end_at: `${date}T23:59`,
      status: "Scheduled",
    },
    "maintenance",
  );
  assert.equal(pilot.status, 403);
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
test("weekly load sheet images upload to Documents and can be removed", async () => {
  const uploaded = await call(
    "/documents",
    "POST",
    {
      folder: "Load Sheets",
      file_name: "week-ending-2030-04-07.jpg",
      mime_type: "image/jpeg",
      image_data: "data:image/jpeg;base64,/9j/4AAQ",
      week_ending: "2030-04-07",
      uploaded_by: "ignored-client-value",
      created_at: new Date().toISOString(),
    },
    "pilot",
  );
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.uploaded_by, "p1");
  let state = await call("/state", "GET", undefined, "maintenance");
  assert(state.data.documents.some((document) => document.id === uploaded.data.id));
  const removed = await call(`/documents/${uploaded.data.id}`, "DELETE", undefined, "maintenance");
  assert.equal(removed.status, 200);
  state = await call("/state", "GET", undefined, "maintenance");
  assert(!state.data.documents.some((document) => document.id === uploaded.data.id));
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
  const startingAircraft = db
    .prepare("select * from aircraft where id='a1'")
    .get();
  const before = startingAircraft.time;
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
  const afterCreate = db.prepare("select * from aircraft where id='a1'").get();
  assert.equal(afterCreate.hobbs, before + 0.5);
  assert.equal(afterCreate.ttsn, startingAircraft.ttsn + 0.5);
  assert.equal(afterCreate.tcsn, startingAircraft.tcsn + 2);
  assert.equal(afterCreate.engine_ttsn, startingAircraft.engine_ttsn + 0.5);
  assert.equal(afterCreate.engine_ttsoh, startingAircraft.engine_ttsoh + 0.5);
  assert.equal(afterCreate.engine_tcsn, startingAircraft.engine_tcsn + 2);
  assert.equal(afterCreate.engine_tcsoh, startingAircraft.engine_tcsoh + 2);
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
  assert.equal(afterEdit.hobbs, beforeEdit.hobbs + 0.3);
  assert.equal(afterEdit.ttsn, beforeEdit.ttsn + 0.3);
  assert.equal(afterEdit.tcsn, beforeEdit.tcsn + 1);
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
test("sequential pilot records stay separate and use the latest aircraft location and totals", async () => {
  const before = db.prepare("select * from aircraft where id='a2'").get();
  const first = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a2",
      pilot_id: "p1",
      dz: "Georgia",
      flight_date: "2030-04-10",
      start_time: before.hobbs,
      end_time: before.hobbs + 0.3,
      start_cycles: before.tcsn,
      end_cycles: before.tcsn + 2,
      loads: 2,
    },
    "pilot",
  );
  assert.equal(first.status, 201);
  const moved = db.prepare("select * from aircraft where id='a2'").get();
  assert.equal(moved.dz, "Georgia");
  assert.equal(moved.hobbs, before.hobbs + 0.3);

  const stale = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a2",
      pilot_id: "p2",
      dz: "Tennessee",
      flight_date: "2030-04-10",
      start_time: before.hobbs,
      end_time: before.hobbs + 0.2,
      start_cycles: before.tcsn,
      end_cycles: before.tcsn + 1,
      loads: 1,
    },
  );
  assert.equal(stale.status, 400);
  assert.match(stale.data.error, /updated by another pilot/i);

  const second = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a2",
      pilot_id: "p2",
      dz: "Tennessee",
      flight_date: "2030-04-10",
      start_time: moved.hobbs,
      end_time: moved.hobbs + 0.4,
      start_cycles: moved.tcsn,
      end_cycles: moved.tcsn + 3,
      loads: 3,
    },
  );
  assert.equal(second.status, 201);
  const finalAircraft = db.prepare("select * from aircraft where id='a2'").get();
  assert.equal(finalAircraft.dz, "Tennessee");
  assert.equal(finalAircraft.hobbs, moved.hobbs + 0.4);
  assert.equal(
    db
      .prepare(
        "select count(*) count from flight_records where id in (?,?) and archived_at is null",
      )
      .get(first.data.id, second.data.id).count,
    2,
  );
});
test("Twin Otter flight advances airframe totals without changing legacy engine fields", async () => {
  db.prepare(
    `update aircraft set hobbs=100,ttsn=9000,tcsn=7000,time=100,cycles=7000,
     engine1_ttsn=5000,engine1_tsmoh=400,engine1_tshsi=200,engine1_tcsn=4500,engine1_tcsoh=300,
     engine2_ttsn=5100,engine2_tsmoh=500,engine2_tshsi=250,engine2_tcsn=4600,engine2_tcsoh=350
     where id='a3'`,
  ).run();
  const result = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a3",
      pilot_id: "p1",
      dz: "Tennessee",
      flight_date: "2030-04-13",
      start_time: 100,
      end_time: 101.2,
      start_cycles: 7000,
      end_cycles: 7004,
      loads: 4,
    },
    "pilot",
  );
  assert.equal(result.status, 201);
  const updated = db.prepare("select * from aircraft where id='a3'").get();
  assert.equal(updated.hobbs, 101.2);
  assert.equal(updated.ttsn, 9001.2);
  assert.equal(updated.tcsn, 7004);
  assert.equal(updated.engine1_ttsn, 5000);
  assert.equal(updated.engine1_tsmoh, 400);
  assert.equal(updated.engine1_tshsi, 200);
  assert.equal(updated.engine1_tcsn, 4500);
  assert.equal(updated.engine1_tcsoh, 300);
  assert.equal(updated.engine2_ttsn, 5100);
  assert.equal(updated.engine2_tcsn, 4600);
});
test("deleting a daily record archives it and reverses aircraft totals", async () => {
  const before = db.prepare("select * from aircraft where id='a2'").get();
  const created = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a2",
      pilot_id: "p1",
      dz: "Georgia",
      flight_date: "2030-04-14",
      start_time: before.hobbs,
      end_time: before.hobbs + 0.7,
      start_cycles: before.tcsn,
      end_cycles: before.tcsn + 3,
      loads: 3,
    },
    "pilot",
  );
  assert.equal(created.status, 201);
  const removed = await call(`/flight_records/${created.data.id}`, "DELETE", undefined, "pilot");
  assert.equal(removed.status, 200);
  const after = db.prepare("select * from aircraft where id='a2'").get();
  assert.equal(after.ttsn, before.ttsn);
  assert.equal(after.tcsn, before.tcsn);
  assert.equal(after.hobbs, before.hobbs);
  assert(
    db.prepare("select archived_at from flight_records where id=?").get(created.data.id).archived_at,
  );
  const state = await call("/state");
  assert(!state.data.flight_records.some((record) => record.id === created.data.id));
});
test("PT6A component cycles follow configured factors and recalculate after corrections", async () => {
  db.prepare(
    `insert into aircraft(id,tail,type,dz,status,time,cycles,maint,hobbs,ttsn,tcsn)
     values('a-pt6','N999PT','PAC 750','Georgia','Available',1000,800,'Current',1000,5000,800)`,
  ).run();
  const engine = await call(
    "/engines",
    "POST",
    {
      aircraft_id: "a-pt6",
      position: "Engine",
      model: "PT6A-34",
      serial_number: "PCE-TEST",
      baseline_ttsn: 5000,
      baseline_csn: 800,
      baseline_starts: 100,
      baseline_flights: 1000,
      cycle_basis: "flights",
      tracking_start_date: "2031-01-01",
      source_reference: "Engine logbook baseline",
    },
    "maintenance",
  );
  assert.equal(engine.status, 201);

  const unreferenced = await call(
    "/engine_components",
    "POST",
    {
      engine_id: engine.data.id,
      description: "Compressor disk",
      part_number: "PN-1",
      serial_number: "SN-1",
      max_cycles: 2000,
      baseline_component_cycles: 100,
      baseline_engine_starts: 100,
      baseline_engine_flights: 1000,
      acf: 4,
      fcf: 1,
      warning_cycles: 250,
      source_reference: "",
      installation_date: "2031-01-01",
    },
    "maintenance",
  );
  assert.equal(unreferenced.status, 400);

  const component = await call(
    "/engine_components",
    "POST",
    {
      engine_id: engine.data.id,
      description: "Compressor disk",
      part_number: "PN-1",
      serial_number: "SN-1",
      max_cycles: 2000,
      baseline_component_cycles: 100,
      baseline_engine_starts: 100,
      baseline_engine_flights: 1000,
      acf: 4,
      fcf: 1,
      warning_cycles: 250,
      source_reference: "P&WC MM TEST REV A",
      source_verified: true,
      installation_date: "2031-01-01",
      maintenance_record: "WO-100",
    },
    "maintenance",
  );
  assert.equal(component.status, 201);
  const pilotDenied = await call(
    "/engine_components",
    "POST",
    { ...component.data, serial_number: "DENIED" },
    "pilot",
  );
  assert.equal(pilotDenied.status, 403);

  const flight = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a-pt6",
      pilot_id: "p1",
      dz: "Georgia",
      flight_date: "2031-01-02",
      start_time: 1000,
      end_time: 1001,
      start_cycles: 800,
      end_cycles: 804,
      loads: 4,
      engine_operations: [
        { engine_id: engine.data.id, starts: 1, flights: 4 },
      ],
    },
    "pilot",
  );
  assert.equal(flight.status, 201);
  let state = await call("/state", "GET", undefined, "maintenance");
  let trackedEngine = state.data.engines.find((entry) => entry.id === engine.data.id);
  let trackedComponent = state.data.engine_components.find((entry) => entry.id === component.data.id);
  assert.equal(trackedEngine.total_starts, 101);
  assert.equal(trackedEngine.total_flights, 1004);
  assert.equal(trackedEngine.current_ttsn, 5001);
  assert.equal(trackedComponent.equivalent_cycles_since_baseline, 1.75);
  assert.equal(trackedComponent.current_cycles, 101.75);
  assert.equal(trackedComponent.remaining_cycles, 1898.25);
  assert.equal(trackedComponent.verification_status, "Verified");

  const duplicate = await call(
    "/flight_records",
    "POST",
    {
      aircraft_id: "a-pt6",
      pilot_id: "p1",
      dz: "Georgia",
      flight_date: "2031-01-02",
      start_time: 1000,
      end_time: 1001,
      start_cycles: 800,
      end_cycles: 804,
      loads: 4,
      engine_operations: [{ engine_id: engine.data.id, starts: 1, flights: 4 }],
    },
    "pilot",
  );
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.data.error, /already exists/i);

  const corrected = await call(
    `/flight_records/${flight.data.id}`,
    "PUT",
    {
      engine_operations: [
        { engine_id: engine.data.id, starts: 2, flights: 5 },
      ],
    },
    "pilot",
  );
  assert.equal(corrected.status, 200);
  state = await call("/state", "GET", undefined, "maintenance");
  trackedComponent = state.data.engine_components.find((entry) => entry.id === component.data.id);
  assert.equal(trackedComponent.equivalent_cycles_since_baseline, 2.75);
  assert.equal(trackedComponent.current_cycles, 102.75);

  const replacement = await call(
    `/engine_components/${component.data.id}/replace`,
    "POST",
    {
      description: "Compressor disk",
      part_number: "PN-2",
      serial_number: "SN-2",
      max_cycles: 2500,
      baseline_component_cycles: 50,
      baseline_engine_starts: 102,
      baseline_engine_flights: 1005,
      acf: 4,
      fcf: 1,
      warning_cycles: 100,
      source_reference: "P&WC MM TEST REV B",
      source_verified: true,
      installation_date: "2031-01-03",
      maintenance_record: "WO-101",
      removed_at: "2031-01-03",
      removed_details: "Removed under WO-101",
    },
    "maintenance",
  );
  assert.equal(replacement.status, 201);
  state = await call("/state", "GET", undefined, "maintenance");
  assert(!state.data.engine_components.some((entry) => entry.id === component.data.id));
  assert(state.data.engine_component_history.some((entry) => entry.id === component.data.id));
  assert(state.data.engine_components.some((entry) => entry.id === replacement.data.id));
});
