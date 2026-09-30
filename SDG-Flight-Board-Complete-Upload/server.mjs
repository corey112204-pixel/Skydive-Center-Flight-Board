import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
const databasePath = process.env.SDG_DB_PATH || "work/sdg-operations.sqlite";
if (process.env.NODE_ENV === "production" && !process.env.SDG_DB_PATH)
  throw Error("SDG_DB_PATH must point to persistent storage in production");
mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
create table if not exists pilots(id text primary key,name text not null,email text not null unique,phone text not null,home text not null,status text not null default 'Available',qual text not null default 'Current',until_text text not null default '',active integer not null default 1,archived_at text);
create table if not exists aircraft(id text primary key,tail text not null unique,type text not null,dz text not null,status text not null,time real not null default 0,cycles integer not null default 0,maint text not null default 'Current',archived_at text);
create table if not exists schedules(id text primary key,kind text not null,pilot_id text,aircraft_id text,dz text not null,start_at text not null,end_at text not null,status text not null default 'Scheduled',notes text,archived_at text);
create table if not exists timeoff(id text primary key,pilot_id text not null,start_date text not null,end_date text not null,reason text not null,notes text,status text not null default 'Pending',created_at text not null);
create table if not exists maintenance(id text primary key,aircraft_id text not null,item text not null,due text not null,remaining real not null,warning real not null,status text not null,completed_at text,archived_at text);
create table if not exists squawks(id text primary key,aircraft_id text not null,pilot_id text not null,dz text not null,description text not null,severity text not null,status text not null default 'Open',aircraft_time real,corrective_action text,created_at text not null,closed_at text,archived_at text);
create table if not exists flight_records(id text primary key,aircraft_id text not null,pilot_id text not null,dz text not null,flight_date text not null,start_time real not null,end_time real not null,total_time real not null,start_cycles integer,end_cycles integer,total_cycles integer,loads integer not null,fuel real,oil real,notes text,created_at text not null);
create table if not exists flight_revisions(id text primary key,record_id text not null,old_value text not null,new_value text not null,reason text not null,created_at text not null);
create table if not exists notifications(id text primary key,title text not null,body text not null,read_at text,created_at text not null);
create table if not exists documents(id text primary key,folder text not null,file_name text not null,mime_type text not null,image_data text not null,week_ending text,uploaded_by text not null,created_at text not null,archived_at text);
create table if not exists audit_logs(id text primary key,action text not null,entity text not null,entity_id text,old_value text,new_value text,actor_role text not null,created_at text not null);`);
db.exec(`create table if not exists users(id text primary key,email text not null unique,name text not null,role text not null,pilot_id text,active integer not null default 1,password_hash text not null,must_change_password integer not null default 1,created_at text not null,updated_at text not null);
create table if not exists sessions(token text primary key,user_id text not null,expires_at text not null,created_at text not null,foreign key(user_id) references users(id) on delete cascade);`);
db.exec(
  `create table if not exists notification_reads(notification_id text not null,user_id text not null,read_at text not null,primary key(notification_id,user_id),foreign key(notification_id) references notifications(id) on delete cascade,foreign key(user_id) references users(id) on delete cascade);`,
);
db.exec(
  `create table if not exists notification_recipients(notification_id text not null,user_id text not null,primary key(notification_id,user_id),foreign key(notification_id) references notifications(id) on delete cascade,foreign key(user_id) references users(id) on delete cascade);`,
);
if (
  !db
    .prepare("pragma table_info(timeoff)")
    .all()
    .some((x) => x.name === "archived_at")
)
  db.exec("alter table timeoff add column archived_at text");
for (const [table, column, type] of [
  ["aircraft", "image_data", "text"],
  ["aircraft", "hobbs", "real"],
  ["aircraft", "ttsn", "real"],
  ["aircraft", "tcsn", "integer"],
  ["aircraft", "engine1_tsmoh", "real"],
  ["aircraft", "engine1_tshsi", "real"],
  ["aircraft", "engine1_tcsoh", "integer"],
  ["aircraft", "engine1_ttsn", "real"],
  ["aircraft", "engine1_tcsn", "integer"],
  ["aircraft", "engine2_tsmoh", "real"],
  ["aircraft", "engine2_tshsi", "real"],
  ["aircraft", "engine2_tcsoh", "integer"],
  ["aircraft", "engine2_ttsn", "real"],
  ["aircraft", "engine2_tcsn", "integer"],
  ["pilots", "medical_class", "text"],
  ["pilots", "medical_expiration", "text"],
  ["pilots", "flight_review_due", "text"],
  ["pilots", "certificate_type", "text"],
  ["pilots", "notes", "text"],
  ["maintenance", "due_kind", "text"],
  ["maintenance", "due_hours", "real"],
  ["maintenance", "due_date", "text"],
  ["maintenance", "warning_hours", "real"],
  ["maintenance", "warning_days", "integer"],
  ["maintenance", "remaining_label", "text"],
  ["maintenance", "interval_hours", "real"],
  ["maintenance", "interval_days", "integer"],
])
  if (
    !db
      .prepare(`pragma table_info(${table})`)
      .all()
      .some((x) => x.name === column)
  )
    db.exec(`alter table ${table} add column ${column} ${type}`);
if (!db.prepare("select count(*) n from pilots").get().n) {
  const pp = db.prepare(
    "insert into pilots(id,name,email,phone,home,status,qual,until_text,active,archived_at) values(?,?,?,?,?,?,?,?,?,null)",
  );
  [
    [
      "p1",
      "Corey Anderson",
      "corey@sdgops.com",
      "(404) 555-0128",
      "Georgia",
      "Flying today",
      "Current",
      "Medical · 184 days",
      1,
    ],
    [
      "p2",
      "Jamie Rivera",
      "jamie@sdgops.com",
      "(205) 555-0142",
      "Alabama",
      "Flying today",
      "Due soon",
      "Flight review · 24 days",
      1,
    ],
    [
      "p3",
      "Morgan Lee",
      "morgan@sdgops.com",
      "(615) 555-0119",
      "Tennessee",
      "Weather hold",
      "Current",
      "Medical · 213 days",
      1,
    ],
    [
      "p4",
      "Taylor Brooks",
      "taylor@sdgops.com",
      "(470) 555-0177",
      "Georgia",
      "Available",
      "Expired",
      "Company check · 6 days ago",
      1,
    ],
  ]
    .filter((x) => process.env.NODE_ENV !== "production" || x[0] === "p1")
    .forEach((x) => pp.run(...x));
}
if (!db.prepare("select count(*) n from aircraft").get().n) {
  const aa = db.prepare(
    "insert into aircraft(id,tail,type,dz,status,time,cycles,maint,archived_at) values(?,?,?,?,?,?,?,?,null)",
  );
  [
    [
      "a1",
      "N750VX",
      "PAC 750",
      "Georgia",
      "Available",
      12487.3,
      8439,
      "Current",
    ],
    [
      "a2",
      "N216PK",
      "PAC 750",
      "Alabama",
      "Available",
      6284.1,
      4200,
      "Current",
    ],
    [
      "a3",
      "N121PM",
      "Twin Otter",
      "Tennessee",
      "Available",
      8921.8,
      6910,
      "Current",
    ],
  ].forEach((x) => aa.run(...x));
}
db.prepare(
  "update aircraft set hobbs=coalesce(hobbs,time),ttsn=coalesce(ttsn,time),tcsn=coalesce(tcsn,cycles)",
).run();
const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const passwordMatches = (password, stored) => {
  const [salt, expectedHex] = String(stored).split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
if (!db.prepare("select count(*) n from users").get().n) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SDG_INITIAL_ADMIN_PASSWORD
  )
    throw Error("SDG_INITIAL_ADMIN_PASSWORD is required on first deployment");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SDG_INITIAL_ADMIN_PASSWORD.length < 12
  )
    throw Error("SDG_INITIAL_ADMIN_PASSWORD must be at least 12 characters");
  const timestamp = new Date().toISOString();
  db.prepare(
    "insert into users(id,email,name,role,pilot_id,active,password_hash,must_change_password,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?)",
  ).run(
    "u1",
    "corey@sdgops.com",
    "Corey Anderson",
    "administrator",
    "p1",
    1,
    hashPassword(process.env.SDG_INITIAL_ADMIN_PASSWORD || "ChangeMe123!"),
    1,
    timestamp,
    timestamp,
  );
}
if (
  process.env.NODE_ENV === "production" &&
  db
    .prepare("select password_hash from users where active=1")
    .all()
    .some((user) => passwordMatches("ChangeMe123!", user.password_hash))
)
  throw Error(
    "An active account still uses the development password. Change it before deployment.",
  );
db.prepare(
  "insert or ignore into notification_recipients(notification_id,user_id) select n.id,u.id from notifications n join users u on u.role='administrator'",
).run();
if (
  process.env.NODE_ENV !== "production" &&
  !db.prepare("select count(*) n from schedules").get().n
) {
  const s = db.prepare("insert into schedules values(?,?,?,?,?,?,?,?,?,null)");
  [
    [
      "s1",
      "pilot",
      "p1",
      "a1",
      "Georgia",
      "2026-09-02T08:00",
      "2026-09-02T17:00",
      "Confirmed",
      "",
    ],
    [
      "s2",
      "pilot",
      "p2",
      "a2",
      "Alabama",
      "2026-09-02T08:00",
      "2026-09-02T17:00",
      "Confirmed",
      "",
    ],
    [
      "s3",
      "pilot",
      "p3",
      "a3",
      "Tennessee",
      "2026-09-02T08:00",
      "2026-09-02T17:00",
      "Scheduled",
      "Weather dependent",
    ],
  ].forEach((x) => s.run(...x));
}
const tables = new Set([
  "pilots",
  "aircraft",
  "schedules",
  "timeoff",
  "maintenance",
  "squawks",
  "flight_records",
  "documents",
  "notifications",
  "audit_logs",
]);
const permissions = {
  pilots: ["administrator", "chief_pilot"],
  aircraft: [
    "administrator",
    "chief_pilot",
    "maintenance",
    "drop_zone_manager",
  ],
  schedules: ["administrator", "chief_pilot", "drop_zone_manager", "maintenance"],
  timeoff: ["administrator", "chief_pilot", "pilot"],
  maintenance: ["administrator", "maintenance"],
  squawks: ["administrator", "maintenance", "pilot"],
  flight_records: ["administrator", "chief_pilot", "pilot"],
  documents: ["administrator", "chief_pilot", "maintenance", "pilot"],
};
const validRoles = new Set([
  "administrator",
  "chief_pilot",
  "maintenance",
  "drop_zone_manager",
  "pilot",
]);
const now = () => new Date().toISOString();
const audit = (action, entity, id, oldV, newV, role) =>
  db
    .prepare("insert into audit_logs values(?,?,?,?,?,?,?,?)")
    .run(
      randomUUID(),
      action,
      entity,
      id,
      oldV ? JSON.stringify(oldV) : null,
      newV ? JSON.stringify(newV) : null,
      role,
      now(),
    );
function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (req.parsedBody) return req.parsedBody;
  let s = "";
  for await (const c of req) s += c;
  if (s.length > 8e6) throw Error("Request too large");
  return s ? JSON.parse(s) : {};
}
function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
function authenticatedUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return null;
  return db
    .prepare(
      "select u.* from sessions s join users u on u.id=s.user_id where s.token=? and s.expires_at>? and u.active=1",
    )
    .get(token, now());
}
export function handler(req, res) {
  (async () => {
    if (req.method === "OPTIONS") return json(res, 204, {});
    const u = new URL(req.url, "http://local"),
      parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api") return json(res, 404, { error: "Not found" });
    if (u.pathname === "/api/auth/login" && req.method === "POST") {
      const d = await body(req);
      const user = db
        .prepare("select * from users where lower(email)=lower(?)")
        .get(String(d.email || "").trim());
      if (
        !user ||
        !user.active ||
        !passwordMatches(String(d.password || ""), user.password_hash)
      )
        return json(res, 401, { error: "Email or password is incorrect" });
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      db.prepare("insert into sessions values(?,?,?,?)").run(
        token,
        user.id,
        expiresAt,
        now(),
      );
      return json(res, 200, { token, user: publicUser(user) });
    }
    const currentUser = authenticatedUser(req);
    if (!currentUser) return json(res, 401, { error: "Please sign in" });
    if (u.pathname === "/api/auth/me" && req.method === "GET")
      return json(res, 200, publicUser(currentUser));
    if (u.pathname === "/api/auth/logout" && req.method === "POST") {
      const token = String(req.headers.authorization).replace(/^Bearer /, "");
      db.prepare("delete from sessions where token=?").run(token);
      return json(res, 200, { ok: true });
    }
    const role = currentUser.role;
    if (
      parts[1] === "notifications" &&
      parts[2] === "read-all" &&
      req.method === "POST"
    ) {
      db.prepare(
        "insert or replace into notification_reads(notification_id,user_id,read_at) select notification_id,user_id,? from notification_recipients where user_id=?",
      ).run(now(), currentUser.id);
      return json(res, 200, { ok: true });
    }
    if (
      parts[1] === "notifications" &&
      parts[2] &&
      parts[3] === "read" &&
      req.method === "POST"
    ) {
      const exists = db
        .prepare(
          "select 1 from notification_recipients where notification_id=? and user_id=?",
        )
        .get(parts[2], currentUser.id);
      if (!exists) return json(res, 404, { error: "Notification not found" });
      db.prepare("insert or replace into notification_reads values(?,?,?)").run(
        parts[2],
        currentUser.id,
        now(),
      );
      return json(res, 200, { ok: true });
    }
    if (parts[1] === "users") {
      if (role !== "administrator")
        return json(res, 403, { error: "Administrator access required" });
      if (req.method === "GET")
        return json(
          res,
          200,
          db.prepare("select * from users order by name").all().map(publicUser),
        );
      if (req.method === "POST") {
        const d = await body(req);
        required(d, ["name", "email", "role", "password"]);
        if (!validRoles.has(d.role)) throw Error("Invalid role");
        if (String(d.password).length < 10)
          throw Error("Temporary password must be at least 10 characters");
        const id = randomUUID(),
          timestamp = now();
        db.prepare("insert into users values(?,?,?,?,?,?,?,?,?,?)").run(
          id,
          String(d.email).trim().toLowerCase(),
          d.name,
          d.role,
          d.pilot_id || null,
          1,
          hashPassword(d.password),
          1,
          timestamp,
          timestamp,
        );
        audit(
          "create",
          "user",
          id,
          null,
          { name: d.name, email: d.email, role: d.role },
          role,
        );
        return json(
          res,
          201,
          publicUser(db.prepare("select * from users where id=?").get(id)),
        );
      }
      if ((req.method === "PUT" || req.method === "PATCH") && parts[2]) {
        const old = db.prepare("select * from users where id=?").get(parts[2]);
        if (!old) return json(res, 404, { error: "Account not found" });
        const d = await body(req);
        if (d.role && !validRoles.has(d.role)) throw Error("Invalid role");
        if (old.id === currentUser.id && Number(d.active) === 0)
          throw Error("You cannot deactivate your own account");
        const next = { ...old, ...d, updated_at: now() };
        let passwordHash = old.password_hash;
        let mustChange = d.must_change_password ?? old.must_change_password;
        if (d.password) {
          if (String(d.password).length < 10)
            throw Error("Temporary password must be at least 10 characters");
          passwordHash = hashPassword(d.password);
          mustChange = 1;
          db.prepare("delete from sessions where user_id=?").run(old.id);
        }
        db.prepare(
          "update users set name=?,email=?,role=?,pilot_id=?,active=?,password_hash=?,must_change_password=?,updated_at=? where id=?",
        ).run(
          next.name,
          String(next.email).trim().toLowerCase(),
          next.role,
          next.pilot_id || null,
          Number(next.active),
          passwordHash,
          Number(mustChange),
          next.updated_at,
          old.id,
        );
        audit(
          "update",
          "user",
          old.id,
          publicUser(old),
          publicUser(next),
          role,
        );
        return json(
          res,
          200,
          publicUser(db.prepare("select * from users where id=?").get(old.id)),
        );
      }
      return json(res, 405, { error: "Method not allowed" });
    }
    if (u.pathname === "/api/state" && req.method === "GET") {
      const state = {};
      for (const t of tables)
        state[t] = db
          .prepare(
            `select * from ${t} where ${["notifications", "audit_logs", "flight_records"].includes(t) ? "1=1" : "archived_at is null"}`,
          )
          .all();
      state.pilots = state.pilots.map((p) => ({
        ...p,
        flight_stats: db
          .prepare(
            "select count(distinct flight_date) days_flown,coalesce(sum(total_time),0) flight_hours,coalesce(sum(loads),0) loads,max(flight_date) last_flight from flight_records where pilot_id=?",
          )
          .get(p.id),
      }));
      state.notifications = state.notifications
        .filter((notification) =>
          db
            .prepare(
              "select 1 from notification_recipients where notification_id=? and user_id=?",
            )
            .get(notification.id, currentUser.id),
        )
        .map((notification) => ({
          ...notification,
          read_at:
            db
              .prepare(
                "select read_at from notification_reads where notification_id=? and user_id=?",
              )
              .get(notification.id, currentUser.id)?.read_at || null,
        }));
      if (role === "pilot") {
        state.timeoff = state.timeoff.filter(
          (x) => x.pilot_id === currentUser.pilot_id,
        );
        state.flight_records = state.flight_records.filter(
          (x) => x.pilot_id === currentUser.pilot_id,
        );
        state.pilots = state.pilots.map((p) => ({
          id: p.id,
          name: p.name,
          home: p.home,
          status: p.status,
        }));
        for (const restricted of [
          "maintenance",
          "squawks",
          "documents",
          "audit_logs",
        ])
          delete state[restricted];
      }
      state.current_user = publicUser(currentUser);
      if (role === "administrator")
        state.users = db
          .prepare("select * from users order by name")
          .all()
          .map(publicUser);
      return json(res, 200, state);
    }
    const resource = parts[1];
    if (!tables.has(resource))
      return json(res, 404, { error: "Unknown resource" });
    if (req.method !== "GET" && !permissions[resource]?.includes(role))
      return json(res, 403, {
        error: `${role} is not authorized for this action`,
      });
    if (
      resource === "timeoff" &&
      req.method === "POST" &&
      !parts[2] &&
      role === "pilot"
    ) {
      const preview = await body(req);
      if (!currentUser.pilot_id)
        return json(res, 403, {
          error: "Your account needs a linked pilot profile",
        });
      preview.pilot_id = currentUser.pilot_id;
      req.parsedBody = preview;
    }
    if (
      resource === "timeoff" &&
      parts[2] &&
      role === "pilot" &&
      ["PUT", "PATCH", "DELETE"].includes(req.method)
    ) {
      const owned = db
        .prepare("select pilot_id from timeoff where id=?")
        .get(parts[2]);
      if (!owned || owned.pilot_id !== currentUser.pilot_id)
        return json(res, 403, {
          error: "Pilots may only change their own time-off requests",
        });
    }
    if (resource === "squawks" && req.method === "POST" && role !== "pilot")
      return json(res, 403, { error: "Only pilots may create squawks" });
    if (
      resource === "squawks" &&
      ["PUT", "PATCH", "DELETE"].includes(req.method) &&
      !["maintenance", "administrator"].includes(role)
    )
      return json(res, 403, {
        error: "Only maintenance may update or close squawks",
      });
    if (req.method === "POST" && resource === "timeoff" && parts[2]) {
      if (!["administrator", "chief_pilot"].includes(role))
        return json(res, 403, {
          error: "Only a chief pilot or administrator may review time off",
        });
      const data = await body(req),
        status = data.status;
      if (!["Approved", "Denied"].includes(status))
        throw Error("Invalid decision");
      const requestOwner = db
        .prepare("select pilot_id from timeoff where id=?")
        .get(parts[2]);
      db.prepare("update timeoff set status=? where id=?").run(
        status,
        parts[2],
      );
      audit(status.toLowerCase(), "timeoff", parts[2], null, { status }, role);
      notify(
        `Time off ${status.toLowerCase()}`,
        `Your request has been ${status.toLowerCase()}.`,
        { pilotIds: [requestOwner?.pilot_id] },
      );
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && resource === "flight_records") {
      const d = await body(req);
      if (role === "pilot") {
        if (!currentUser.pilot_id)
          return json(res, 403, {
            error: "Your account needs a linked pilot profile",
          });
        d.pilot_id = currentUser.pilot_id;
      }
      required(d, [
        "aircraft_id",
        "pilot_id",
        "dz",
        "flight_date",
        "start_time",
        "end_time",
        "loads",
      ]);
      if (+d.end_time < +d.start_time)
        throw Error("Ending time must be greater than starting time");
      const ac = db
        .prepare("select * from aircraft where id=?")
        .get(d.aircraft_id);
      if (!ac) throw Error("Aircraft not found");
      const id = randomUUID(),
        total = +(+d.end_time - +d.start_time).toFixed(1),
        tc =
          d.end_cycles == null ? null : +d.end_cycles - (+d.start_cycles || 0);
      db.exec("begin immediate");
      try {
        db.prepare(
          "insert into flight_records values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          d.aircraft_id,
          d.pilot_id,
          d.dz,
          d.flight_date,
          +d.start_time,
          +d.end_time,
          total,
          d.start_cycles || null,
          d.end_cycles || null,
          tc,
          +d.loads,
          d.fuel || null,
          d.oil || null,
          d.notes || "",
          now(),
        );
        db.prepare(
          `update aircraft set time=?,hobbs=?,cycles=coalesce(?,cycles),
           ttsn=coalesce(ttsn,time)+?,tcsn=coalesce(tcsn,cycles)+?,
           engine1_tsmoh=case when engine1_tsmoh is null then null else engine1_tsmoh+? end,
           engine1_tshsi=case when engine1_tshsi is null then null else engine1_tshsi+? end,
           engine1_tcsoh=case when engine1_tcsoh is null then null else engine1_tcsoh+? end,
           engine1_ttsn=case when engine1_ttsn is null then null else engine1_ttsn+? end,
           engine1_tcsn=case when engine1_tcsn is null then null else engine1_tcsn+? end,
           engine2_tsmoh=case when engine2_tsmoh is null then null else engine2_tsmoh+? end,
           engine2_tshsi=case when engine2_tshsi is null then null else engine2_tshsi+? end,
           engine2_tcsoh=case when engine2_tcsoh is null then null else engine2_tcsoh+? end,
           engine2_ttsn=case when engine2_ttsn is null then null else engine2_ttsn+? end,
           engine2_tcsn=case when engine2_tcsn is null then null else engine2_tcsn+? end
           where id=?`,
        ).run(
          +d.end_time, +d.end_time, d.end_cycles ?? null,
          total, tc || 0, total, total, tc || 0, total, tc || 0,
          total, total, tc || 0, total, tc || 0,
          d.aircraft_id,
        );
        if (d.squawk_description) {
          const squawkId = randomUUID();
          db.prepare(
            "insert into squawks(id,aircraft_id,pilot_id,dz,description,severity,status,aircraft_time,created_at) values(?,?,?,?,?,?,?,?,?)",
          ).run(
            squawkId,
            d.aircraft_id,
            d.pilot_id,
            d.dz,
            d.squawk_description,
            "Information",
            "Open",
            +d.end_time,
            now(),
          );
          audit(
            "create",
            "squawk",
            squawkId,
            null,
            { description: d.squawk_description, severity: "Information" },
            role,
          );
          notify("New aircraft squawk", `${ac.tail}: ${d.squawk_description}`, {
            roles: ["maintenance", "administrator"],
          });
        }
        audit("create", "flight_record", id, null, d, role);
        notify(
          "Daily record submitted",
          `${ac.tail}: ${d.loads} loads, ${total} hours`,
          { pilotIds: [d.pilot_id] },
        );
        db.exec("commit");
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
      return json(res, 201, { id, total_time: total });
    }
    if (
      (req.method === "PUT" || req.method === "PATCH") &&
      resource === "flight_records" &&
      parts[2]
    ) {
      const old = db
        .prepare("select * from flight_records where id=?")
        .get(parts[2]);
      if (!old) return json(res, 404, { error: "Record not found" });
      const userId = currentUser.pilot_id;
      if (role === "pilot" && old.pilot_id !== userId)
        return json(res, 403, {
          error: "Pilots may only edit their own records",
        });
      const d = await body(req);
      const aircraftId = String(d.aircraft_id || old.aircraft_id);
      const aircraft = db
        .prepare("select * from aircraft where id=? and archived_at is null")
        .get(aircraftId);
      if (!aircraft) throw Error("Aircraft not found");
      const startTime = Number(d.start_time ?? old.start_time);
      const endTime = Number(d.end_time ?? old.end_time);
      const startCycles = Number(d.start_cycles ?? old.start_cycles ?? 0);
      const endCycles = Number(d.end_cycles ?? old.end_cycles ?? startCycles);
      const loads = Number(d.loads ?? old.loads);
      const flightDate = String(d.flight_date ?? old.flight_date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate))
        throw Error("A valid operating date is required");
      if (!Number.isFinite(endTime) || endTime < startTime)
        throw Error("Ending time must be greater than starting time");
      if (!Number.isFinite(endCycles) || endCycles < startCycles)
        throw Error("Ending cycles cannot be less than starting cycles");
      if (!Number.isInteger(loads) || loads < 0)
        throw Error("Loads must be a whole number of zero or more");
      const totalTime = +(endTime - startTime).toFixed(1);
      const totalCycles = endCycles - startCycles;
      const updated = {
        ...old,
        aircraft_id: aircraftId,
        dz: aircraft.dz,
        flight_date: flightDate,
        start_time: startTime,
        end_time: endTime,
        total_time: totalTime,
        start_cycles: startCycles,
        end_cycles: endCycles,
        total_cycles: totalCycles,
        loads,
        notes: d.notes ?? old.notes ?? "",
      };
      db.exec("begin immediate");
      try {
        db.prepare(
          "update flight_records set aircraft_id=?,dz=?,flight_date=?,start_time=?,end_time=?,total_time=?,start_cycles=?,end_cycles=?,total_cycles=?,loads=?,notes=? where id=?",
        ).run(
          aircraftId,
          aircraft.dz,
          flightDate,
          startTime,
          endTime,
          totalTime,
          startCycles,
          endCycles,
          totalCycles,
          loads,
          updated.notes,
          old.id,
        );
        if (aircraftId === old.aircraft_id) {
          updateAircraftTotals(
            old.aircraft_id,
            +(totalTime - Number(old.total_time)).toFixed(1),
            totalCycles - Number(old.total_cycles || 0),
          );
        } else {
          updateAircraftTotals(
            old.aircraft_id,
            -Number(old.total_time),
            -Number(old.total_cycles || 0),
          );
          updateAircraftTotals(aircraftId, totalTime, totalCycles);
        }
        db.prepare("insert into flight_revisions values(?,?,?,?,?,?)").run(
          randomUUID(),
          old.id,
          JSON.stringify(old),
          JSON.stringify(updated),
          d.reason || "Daily operations entry corrected",
          now(),
        );
        if (d.squawk_description) {
          const squawkId = randomUUID();
          db.prepare(
            "insert into squawks(id,aircraft_id,pilot_id,dz,description,severity,status,aircraft_time,created_at) values(?,?,?,?,?,?,?,?,?)",
          ).run(
            squawkId,
            aircraftId,
            old.pilot_id,
            aircraft.dz,
            d.squawk_description,
            "Information",
            "Open",
            endTime,
            now(),
          );
          audit(
            "create",
            "squawk",
            squawkId,
            null,
            { description: d.squawk_description, severity: "Information" },
            role,
          );
          const ac = db
            .prepare("select tail from aircraft where id=?")
            .get(aircraftId);
          notify(
            "New information squawk",
            `${ac?.tail || "Aircraft"}: ${d.squawk_description}`,
            { roles: ["maintenance", "administrator"] },
          );
        }
        audit("update", "flight_record", old.id, old, updated, role);
        notify("Daily record updated", `${loads} loads, ${totalTime} hours`, {
          pilotIds: [old.pilot_id],
        });
        db.exec("commit");
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
      return json(res, 200, updated);
    }
    if (req.method === "POST") {
      const d = await body(req);
      if (resource === "schedules" && role === "maintenance" && d.kind !== "maintenance")
        return json(res, 403, { error: "Maintenance may only schedule aircraft maintenance" });
      if (role === "pilot" && resource === "squawks") {
        if (!currentUser.pilot_id)
          return json(res, 403, {
            error: "Your account needs a linked pilot profile",
          });
        d.pilot_id = currentUser.pilot_id;
      }
      if (role === "pilot" && resource === "documents")
        d.uploaded_by = currentUser.pilot_id || currentUser.id;
      if (resource === "squawks") {
        d.created_at = d.created_at || now();
        d.status = d.status || "Open";
      }
      validate(resource, d);
      if (resource === "schedules") validateSchedule(d);
      const id = randomUUID(),
        cols = Object.keys(d),
        vals = Object.values(d);
      db.prepare(
        `insert into ${resource}(id,${cols.join(",")}) values(?${",?".repeat(cols.length)})`,
      ).run(id, ...vals);
      audit("create", resource, id, null, d, role);
      notify(
        `${singular(resource)} created`,
        `${singular(resource)} record was created.`,
        resource === "squawks"
          ? { roles: ["maintenance", "administrator"] }
          : ["timeoff", "schedules"].includes(resource) && d.pilot_id
            ? { pilotIds: [d.pilot_id] }
            : { userIds: [currentUser.id] },
      );
      return json(res, 201, { id, ...d });
    }
    if ((req.method === "PUT" || req.method === "PATCH") && parts[2]) {
      const old = db
        .prepare(`select * from ${resource} where id=?`)
        .get(parts[2]);
      if (!old) return json(res, 404, { error: "Record not found" });
      const d = await body(req),
        cols = Object.keys(d);
      if (resource === "schedules" && role === "maintenance" &&
          (old.kind !== "maintenance" || (d.kind && d.kind !== "maintenance")))
        return json(res, 403, { error: "Maintenance may only edit aircraft maintenance" });
      if (resource === "schedules")
        validateSchedule({ ...old, ...d }, parts[2]);
      db.prepare(
        `update ${resource} set ${cols.map((x) => `${x}=?`).join(",")} where id=?`,
      ).run(...Object.values(d), parts[2]);
      audit("update", resource, parts[2], old, d, role);
      notify(
        `${singular(resource)} updated`,
        `${singular(resource)} record was updated.`,
        resource === "squawks"
          ? { pilotIds: [old.pilot_id], userIds: [currentUser.id] }
          : resource === "schedules" && (d.pilot_id || old.pilot_id)
            ? { pilotIds: [d.pilot_id || old.pilot_id] }
            : { userIds: [currentUser.id] },
      );
      return json(res, 200, { ...old, ...d });
    }
    if (req.method === "DELETE" && parts[2]) {
      const old = db
        .prepare(`select * from ${resource} where id=?`)
        .get(parts[2]);
      if (!old) return json(res, 404, { error: "Record not found" });
      if (resource === "schedules" && role === "maintenance" && old.kind !== "maintenance")
        return json(res, 403, { error: "Maintenance may only remove aircraft maintenance" });
      if (!Object.hasOwn(old, "archived_at"))
        return json(res, 405, { error: "This record cannot be archived" });
      db.prepare(`update ${resource} set archived_at=? where id=?`).run(
        now(),
        parts[2],
      );
      audit("archive", resource, parts[2], old, null, role);
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  })().catch((e) => json(res, 400, { error: e.message || "Request failed" }));
}
function required(d, ks) {
  for (const k of ks)
    if (d[k] === undefined || d[k] === null || d[k] === "")
      throw Error(`${k.replaceAll("_", " ")} is required`);
}
function updateAircraftTotals(id, timeDelta, cycleDelta) {
  db.prepare(
    `update aircraft set
      time=time+?,hobbs=coalesce(hobbs,time)+?,cycles=cycles+?,
      ttsn=coalesce(ttsn,time)+?,tcsn=coalesce(tcsn,cycles)+?,
      engine1_tsmoh=case when engine1_tsmoh is null then null else engine1_tsmoh+? end,
      engine1_tshsi=case when engine1_tshsi is null then null else engine1_tshsi+? end,
      engine1_tcsoh=case when engine1_tcsoh is null then null else engine1_tcsoh+? end,
      engine1_ttsn=case when engine1_ttsn is null then null else engine1_ttsn+? end,
      engine1_tcsn=case when engine1_tcsn is null then null else engine1_tcsn+? end,
      engine2_tsmoh=case when engine2_tsmoh is null then null else engine2_tsmoh+? end,
      engine2_tshsi=case when engine2_tshsi is null then null else engine2_tshsi+? end,
      engine2_tcsoh=case when engine2_tcsoh is null then null else engine2_tcsoh+? end,
      engine2_ttsn=case when engine2_ttsn is null then null else engine2_ttsn+? end,
      engine2_tcsn=case when engine2_tcsn is null then null else engine2_tcsn+? end
      where id=?`,
  ).run(
    timeDelta, timeDelta, cycleDelta, timeDelta, cycleDelta,
    timeDelta, timeDelta, cycleDelta, timeDelta, cycleDelta,
    timeDelta, timeDelta, cycleDelta, timeDelta, cycleDelta, id,
  );
}
function validate(r, d) {
  const req = {
    pilots: ["name", "email", "phone", "home"],
    aircraft: ["tail", "type", "dz", "status"],
    schedules: ["kind", "dz", "start_at", "end_at"],
    timeoff: ["pilot_id", "start_date", "end_date", "reason"],
    maintenance: [
      "aircraft_id",
      "item",
      "due",
      "remaining",
      "warning",
      "status",
    ],
    squawks: ["aircraft_id", "pilot_id", "dz", "description", "severity"],
    documents: [
      "folder",
      "file_name",
      "mime_type",
      "image_data",
      "uploaded_by",
      "created_at",
    ],
  }[r];
  if (req) required(d, req);
}
function validateSchedule(d, ignore) {
  if (!["pilot", "maintenance"].includes(d.kind))
    throw Error("Choose a valid schedule type");
  if (!d.aircraft_id) throw Error("Aircraft is required");
  if (d.kind === "pilot" && !d.pilot_id) throw Error("Pilot is required");
  if (d.kind === "maintenance" && d.pilot_id)
    throw Error("Maintenance cannot have a pilot assignment");
  if (d.end_at <= d.start_at) throw Error("End must be after start");
  if (d.aircraft_id) {
    const a = db
      .prepare("select status from aircraft where id=?")
      .get(d.aircraft_id);
    if (
      a &&
      d.kind !== "maintenance" &&
      ["Grounded", "Maintenance"].includes(a.status) &&
      !d.admin_override
    )
      throw Error(`${a.status} aircraft require an administrator override`);
  }
  const overlap = db
    .prepare(
      `select id from schedules where archived_at is null and status != 'Cancelled' and id != ? and (? < end_at and ? > start_at) and ((pilot_id is not null and pilot_id=?) or (aircraft_id is not null and aircraft_id=?))`,
    )
    .get(
      ignore || "",
      d.start_at,
      d.end_at,
      d.pilot_id || "",
      d.aircraft_id || "",
    );
  if (overlap)
    throw Error("Pilot or aircraft is already scheduled during this period");
  if (d.pilot_id) {
    const day = d.start_at.slice(0, 10),
      off = db
        .prepare(
          "select id from timeoff where pilot_id=? and status='Approved' and ? between start_date and end_date",
        )
        .get(d.pilot_id, day);
    if (off) throw Error("Pilot has approved time off");
  }
}
function singular(s) {
  return s.replace(/_/g, " ").replace(/s$/, "");
}
function notify(title, body, targets = {}) {
  const id = randomUUID();
  db.prepare("insert into notifications values(?,?,?,?,?)").run(
    id,
    title,
    body,
    null,
    now(),
  );
  const userIds = new Set(targets.userIds || []);
  for (const pilotId of targets.pilotIds || []) {
    for (const user of db
      .prepare("select id from users where pilot_id=? and active=1")
      .all(pilotId))
      userIds.add(user.id);
  }
  for (const role of targets.roles || []) {
    for (const user of db
      .prepare("select id from users where role=? and active=1")
      .all(role))
      userIds.add(user.id);
  }
  const add = db.prepare(
    "insert or ignore into notification_recipients values(?,?)",
  );
  for (const userId of userIds) if (userId) add.run(id, userId);
  return id;
}
if (import.meta.url === `file://${process.argv[1]}`)
  createServer(handler).listen(3001, "127.0.0.1", () =>
    console.info("SDG API http://127.0.0.1:3001"),
  );
