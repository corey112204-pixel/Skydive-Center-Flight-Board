import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Plane,
  Users,
  Wrench,
  TriangleAlert,
  ClipboardCheck,
  Palmtree,
  ChartNoAxesCombined,
  FolderOpen,
  Settings,
  Search,
  Bell,
  Menu,
  Plus,
  ArrowUpRight,
  Clock3,
  Fuel,
  CircleGauge,
  ChevronDown,
  X,
  Check,
  FileText,
  Camera,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import type { DZ, Page, Tone } from "./types";
import { aircraft, pilots } from "./data";
import { api, type State } from "./api";

const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["schedule", "Schedule", CalendarDays],
  ["aircraft", "Aircraft", Plane],
  ["pilots", "Pilots", Users],
  ["maintenance", "Maintenance", Wrench],
  ["squawks", "Squawks", TriangleAlert],
  ["daily", "Daily operations", ClipboardCheck],
  ["timeoff", "Time off", Palmtree],
  ["reports", "Reports", ChartNoAxesCombined],
  ["documents", "Documents", FolderOpen],
  ["admin", "Admin", Settings],
] as const;
const colors: Record<Tone, string> = {
  green: "success",
  amber: "warning",
  red: "danger",
  blue: "info",
  gray: "neutral",
};
const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const calendarDate = (date: string) => new Date(`${date}T12:00:00`);
const addCalendarDays = (date: string, days: number) => {
  const next = calendarDate(date);
  next.setDate(next.getDate() + days);
  return localDate(next);
};
const addCalendarMonths = (date: string, months: number) => {
  const next = calendarDate(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return localDate(next);
};
const calendarLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  calendarDate(date).toLocaleDateString("en-US", options);
function Badge({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className={`badge ${colors[tone]}`}>
      <i />
      {children}
    </span>
  );
}
function Stat({
  label,
  value,
  sub,
  tone = "blue",
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
  Icon: any;
}) {
  return (
    <div className="stat">
      <span className={`stat-icon ${colors[tone]}`}>
        <Icon size={19} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function App() {
  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem("sdg_session")),
  );
  const [loading, setLoading] = useState(authenticated);
  const [page, setPage] = useState<Page>("dashboard");
  const [dz, setDz] = useState<DZ>("ALL");
  const [menu, setMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [modal, setModal] = useState<
    | "day"
    | "squawk"
    | "pilot"
    | "aircraft"
    | "timeoff"
    | "assignment"
    | "maintenance"
    | "engine"
    | "engineComponent"
    | "replaceEngineComponent"
    | "loadsheet"
    | "account"
    | null
  >(null);
  const [editing, setEditing] = useState<any>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<State>({});
  const currentUser: any = state.current_user || {};
  const notifications = [...(state.notifications || [])].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  const unreadNotifications = notifications.filter((x) => !x.read_at).length;
  const activeSquawks = (state.squawks || []).filter(
    (x) => x.status !== "Closed",
  ).length;
  const refresh = (silent = false) =>
    api
      .state()
      .then((data) => {
        setState(data);
        setAuthenticated(true);
      })
      .catch((e) => {
        if (!silent) setError(e.message);
        if (!localStorage.getItem("sdg_session")) setAuthenticated(false);
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const sync = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const timer = window.setInterval(sync, 3000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [authenticated]);
  useEffect(() => {
    if (selectedAircraft) {
      const updated = (state.aircraft || []).find(
        (a) => a.id === selectedAircraft.id,
      );
      if (updated) setSelectedAircraft(updated);
      else setSelectedAircraft(null);
    }
  }, [state.aircraft]);
  useEffect(() => {
    if (
      currentUser.role === "pilot" &&
      !["schedule", "aircraft", "daily", "timeoff"].includes(page)
    )
      setPage("schedule");
  }, [currentUser.role, page]);
  const go = (p: Page) => {
    setPage(p);
    setMenu(false);
    window.scrollTo(0, 0);
  };
  const submit = async (action: () => Promise<any>, msg: string) => {
    setError("");
    try {
      await action();
      await refresh();
      setModal(null);
      setEditing(null);
      setToast(msg);
      setTimeout(() => setToast(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (loading)
    return <div className="app-loading">Loading SDG Operations…</div>;
  if (!authenticated)
    return (
      <Login
        error={error}
        submit={async (email, password) => {
          setError("");
          try {
            await api.login(email, password);
            setLoading(true);
            await refresh();
          } catch (e: any) {
            setError(e.message);
          }
        }}
      />
    );
  return (
    <div className="app">
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <span>
            <Plane />
          </span>
          <div>
            <b>SDG</b>
            <small>FLIGHT OPERATIONS</small>
          </div>
          <button onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav
            .filter(([id]) => {
              if (currentUser.role === "pilot")
                return ["schedule", "aircraft", "daily", "timeoff"].includes(
                  id,
                );
              if (id === "admin") return currentUser.role === "administrator";
              if (id === "squawks") return currentUser.role !== "pilot";
              return true;
            })
            .map(([id, label, Icon]) => (
              <button
                className={page === id ? "active" : ""}
                onClick={() => go(id)}
                key={id}
              >
                <Icon />
                {label}
                {id === "squawks" && activeSquawks > 0 && <em>{activeSquawks}</em>}
              </button>
            ))}
        </nav>
        <div className="user">
          <div>
            {String(currentUser.name || "User")
              .split(" ")
              .map((x: string) => x[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span>
            <b>{currentUser.name}</b>
            <small>{roleLabel(currentUser.role)}</small>
          </span>
          <button
            className="logout-link"
            onClick={async () => {
              await api.logout();
              setAuthenticated(false);
              setState({});
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <button className="hamb" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="search">
            <Search />
            <input placeholder="Search pilots, aircraft, squawks…" />
          </div>
          <button
            className="icon"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell />
            {unreadNotifications > 0 && <b>{unreadNotifications}</b>}
          </button>
          {notificationsOpen && (
            <div className="notification-popover">
              <header>
                <span>
                  <strong>Notifications</strong>
                  <small>{unreadNotifications} unread</small>
                </span>
                {unreadNotifications > 0 && (
                  <button
                    onClick={async () => {
                      await api.readAllNotifications();
                      await refresh();
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </header>
              <div className="notification-list">
                {notifications.slice(0, 25).map((notification) => (
                  <button
                    key={notification.id}
                    className={notification.read_at ? "" : "unread"}
                    onClick={async () => {
                      if (!notification.read_at) {
                        await api.readNotification(notification.id);
                        await refresh();
                      }
                    }}
                  >
                    <i />
                    <span>
                      <b>{notification.title}</b>
                      <p>{notification.body}</p>
                      <small>
                        {new Date(notification.created_at).toLocaleString()}
                      </small>
                    </span>
                  </button>
                ))}
                {!notifications.length && (
                  <div className="notification-empty">
                    <Bell />
                    <b>You’re all caught up</b>
                    <small>New operational alerts will appear here.</small>
                  </div>
                )}
              </div>
            </div>
          )}
          <button className="avatar">
            {String(currentUser.name || "User")
              .split(" ")
              .map((x: string) => x[0])
              .join("")
              .slice(0, 2)}
          </button>
        </div>
        <div className="content">
          {error && (
            <div className="form-error">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {page === "dashboard" ? (
            <Dashboard dz={dz} setDz={setDz} state={state} go={go} />
          ) : page === "schedule" ? (
            <Schedule
              items={state.schedules || []}
              pilots={state.pilots || []}
              aircraft={state.aircraft || []}
              canEditPilot={["administrator", "chief_pilot", "drop_zone_manager"].includes(currentUser.role)}
              canEditMaintenance={["administrator", "chief_pilot", "drop_zone_manager", "maintenance"].includes(currentUser.role)}
              open={(value) => {
                setEditing(value);
                setModal("assignment");
              }}
            />
          ) : page === "aircraft" ? (
            <Aircraft
              items={state.aircraft || []}
              open={
                currentUser.role === "pilot"
                  ? undefined
                  : () => setModal("aircraft")
              }
              inspect={(a) => {
                if (currentUser.role === "pilot") return;
                setSelectedAircraft(a);
                setPage("maintenance");
              }}
              readOnly={currentUser.role === "pilot"}
            />
          ) : page === "pilots" ? (
            <Pilots
              items={state.pilots || []}
              open={(p) => {
                setEditing(p || null);
                setModal("pilot");
              }}
            />
          ) : page === "maintenance" ? (
            <Maintenance
              aircraft={selectedAircraft}
              items={state.maintenance || []}
              engines={state.engines || []}
              engineComponents={state.engine_components || []}
              componentHistory={state.engine_component_history || []}
              back={() => {
                setSelectedAircraft(null);
                setPage("aircraft");
              }}
              action={(item: any) => {
                setEditing(item);
                setModal("maintenance");
              }}
              engineAction={(engine: any) => {
                setEditing(engine || null);
                setModal("engine");
              }}
              componentAction={(component: any, engine: any) => {
                setEditing({ ...(component || {}), _engine: engine });
                setModal("engineComponent");
              }}
              replaceComponent={(component: any, engine: any) => {
                setEditing({ ...component, _engine: engine });
                setModal("replaceEngineComponent");
              }}
              update={(id: string, d: any, msg: string) =>
                submit(() => api.update("aircraft", id, d), msg)
              }
              remove={(id: string) =>
                submit(() => api.archive("aircraft", id), "Aircraft removed from the active fleet")
              }
            />
          ) : page === "squawks" ? (
            <Squawks
              items={state.squawks || []}
              aircraft={state.aircraft || []}
              open={(x) => {
                setEditing(x || null);
                setModal("squawk");
              }}
            />
          ) : page === "daily" ? (
            <Daily
              open={async (record) => {
                try {
                  const latest = await api.state();
                  setState(latest);
                  setEditing(
                    record?.id
                      ? (latest.flight_records || []).find((item: any) => item.id === record.id) || record
                      : null,
                  );
                  setModal("day");
                } catch (e: any) {
                  setError(e.message);
                }
              }}
              upload={() => setModal("loadsheet")}
              records={state.flight_records || []}
              aircraft={state.aircraft || []}
              pilots={state.pilots || []}
            />
          ) : page === "timeoff" ? (
            <TimeOff
              items={(state.timeoff || []).filter(
                (x) => x.pilot_id === currentUser.pilot_id,
              )}
              open={() => setModal("timeoff")}
            />
          ) : page === "reports" ? (
            <Reports state={state} />
          ) : page === "documents" ? (
            <Documents
              items={state.documents || []}
              remove={(id) =>
                submit(
                  () => api.archive("documents", id),
                  "Document deleted",
                )
              }
            />
          ) : page === "admin" ? (
            <Admin
              users={(state.users || []) as any[]}
              pilots={state.pilots || []}
              open={(user) => {
                setEditing(user || null);
                setModal("account");
              }}
            />
          ) : (
            <Placeholder page={page} />
          )}
        </div>
      </main>
      <div className="mobile-nav">
        {currentUser.role !== "pilot" && (
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => go("dashboard")}
          >
            <LayoutDashboard />
            <span>Home</span>
          </button>
        )}
        <button
          className={page === "schedule" ? "active" : ""}
          onClick={() => go("schedule")}
        >
          <CalendarDays />
          <span>Schedule</span>
        </button>
        <button className="enter" onClick={() => setModal("day")}>
          <Plus />
          <span>Enter day</span>
        </button>
        {currentUser.role === "pilot" && (
          <button
            className={page === "aircraft" ? "active" : ""}
            onClick={() => go("aircraft")}
          >
            <Plane />
            <span>Aircraft</span>
          </button>
        )}
        {currentUser.role === "pilot" && (
          <button
            className={page === "timeoff" ? "active" : ""}
            onClick={() => go("timeoff")}
          >
            <Palmtree />
            <span>Time off</span>
          </button>
        )}
        {currentUser.role !== "pilot" && (
          <button onClick={() => go("squawks")}>
            <TriangleAlert />
            <span>Squawks</span>
          </button>
        )}
        {currentUser.role !== "pilot" && (
          <button onClick={() => setMenu(true)}>
            <Menu />
            <span>More</span>
          </button>
        )}
      </div>
      {modal === "day" && (
        <DayModal
          value={editing}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          aircraft={state.aircraft || []}
          engines={state.engines || []}
          remove={
            editing?.id
              ? () =>
                  submit(
                    () => api.archive("flight_records", editing.id),
                    "Daily operation entry deleted",
                  )
              : undefined
          }
          submit={(d) =>
            submit(
              () =>
                editing?.id
                  ? api.updateFlight(editing.id, d)
                  : api.submitFlight(d),
              editing?.id
                ? "Daily flight record updated successfully"
                : "Daily flight record submitted successfully",
            )
          }
        />
      )}{" "}
      {modal === "account" && (
        <AccountModal
          value={editing}
          pilots={state.pilots || []}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          submit={(d) =>
            submit(
              () =>
                editing?.id ? api.updateUser(editing.id, d) : api.createUser(d),
              editing?.id ? "Account updated" : "Account created",
            )
          }
        />
      )}{" "}
      {modal === "squawk" && (
        <SquawkModal
          value={editing}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          aircraft={state.aircraft || []}
          deleteSquawk={
            editing?.id
              ? () =>
                  submit(
                    () => api.archive("squawks", editing.id),
                    "Squawk removed from the active list",
                  )
              : undefined
          }
          submit={(d) =>
            submit(
              () =>
                editing?.id
                  ? api.updateSquawk(editing.id, d)
                  : api.createSquawk(d),
              editing?.id
                ? "Squawk updated"
                : "Squawk submitted — maintenance has been notified",
            )
          }
        />
      )}{" "}
      {modal === "pilot" && (
        <PilotModal
          value={editing}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          submit={(d) =>
            submit(
              () =>
                editing?.id
                  ? api.update("pilots", editing.id, d)
                  : api.create("pilots", d),
              editing?.id
                ? "Pilot profile updated"
                : "Pilot added successfully",
            )
          }
        />
      )}{" "}
      {modal === "aircraft" && (
        <AircraftModal
          close={() => setModal(null)}
          submit={(d) =>
            submit(
              () => api.create("aircraft", d),
              "Aircraft added successfully",
            )
          }
        />
      )}{" "}
      {modal === "timeoff" && (
        <TimeOffModal
          close={() => setModal(null)}
          submit={(d) =>
            submit(() => api.createTimeOff(d), "Time off request submitted")
          }
        />
      )}{" "}
      {modal === "loadsheet" && (
        <LoadSheetModal
          close={() => setModal(null)}
          submit={(d) =>
            submit(
              () => api.uploadDocument(d),
              "Weekly load sheet saved in Documents",
            )
          }
        />
      )}{" "}
      {modal === "assignment" && (
        <AssignmentModal
          value={editing}
          pilots={state.pilots || []}
          aircraft={state.aircraft || []}
          canEdit={editing?.kind === "maintenance"
            ? ["administrator", "chief_pilot", "drop_zone_manager", "maintenance"].includes(currentUser.role)
            : ["administrator", "chief_pilot", "drop_zone_manager"].includes(currentUser.role)}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          save={(d) =>
            submit(
              () =>
                editing?.id
                  ? api.update("schedules", editing.id, d)
                  : api.create("schedules", d),
              editing?.id ? "Assignment updated" : "Assignment created",
            )
          }
          remove={
            editing?.id
              ? () =>
                  submit(
                    () => api.archive("schedules", editing.id),
                    "Assignment cancelled",
                  )
              : undefined
          }
        />
      )}{" "}
      {modal === "maintenance" && (
        <MaintenanceModal
          value={editing}
          aircraft={selectedAircraft}
          close={() => {
            setModal(null);
            setEditing(null);
          }}
          save={(d) =>
            submit(
              () =>
                editing?.id
                  ? api.update("maintenance", editing.id, d)
                  : api.create("maintenance", d),
              editing?.id
                ? "Maintenance item updated"
                : "Maintenance item added",
            )
          }
          remove={
            editing?.id
              ? () =>
                  submit(
                    () => api.archive("maintenance", editing.id),
                    "Maintenance item deleted",
                  )
              : undefined
          }
        />
      )}{" "}
      {modal === "engine" && (
        <EngineModal
          value={editing}
          aircraft={selectedAircraft}
          close={() => { setModal(null); setEditing(null); }}
          save={(d) => submit(
            () => editing?.id ? api.update("engines", editing.id, d) : api.create("engines", d),
            editing?.id ? "Engine configuration updated" : "Engine configuration added",
          )}
          remove={editing?.id ? () => submit(
            () => api.archive("engines", editing.id),
            "Engine configuration archived",
          ) : undefined}
        />
      )}{" "}
      {modal === "engineComponent" && (
        <EngineComponentModal
          value={editing?.id ? editing : null}
          engine={editing?._engine}
          close={() => { setModal(null); setEditing(null); }}
          save={(d) => submit(
            () => editing?.id ? api.update("engine_components", editing.id, d) : api.create("engine_components", d),
            editing?.id ? "Life-limited component updated" : "Life-limited component added",
          )}
          remove={editing?.id ? () => submit(
            () => api.archive("engine_components", editing.id),
            "Component archived",
          ) : undefined}
        />
      )}{" "}
      {modal === "replaceEngineComponent" && (
        <EngineComponentModal
          value={editing}
          engine={editing?._engine}
          replacement
          close={() => { setModal(null); setEditing(null); }}
          save={(d) => submit(
            () => api.replaceEngineComponent(editing.id, d),
            "Component replaced and removed component archived",
          )}
        />
      )}{" "}
      {toast && (
        <div className="toast">
          <Check />
          {toast}
        </div>
      )}{" "}
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}{" "}
    </div>
  );
}

function PageHead({
  eyebrow = "OPERATIONS",
  title,
  desc,
  button,
  Icon = Plus,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  desc: string;
  button?: string;
  Icon?: any;
  onAction?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {button && (
        <button className="primary" onClick={onAction}>
          <Icon />
          {button}
        </button>
      )}
    </div>
  );
}
function Dashboard({
  dz,
  setDz,
  state,
  go,
}: {
  dz: DZ;
  setDz: (d: DZ) => void;
  state: State;
  go: (p: Page) => void;
}) {
  const today = localDate();
  const zones: Record<string, string> = {
    GA: "Georgia",
    AL: "Alabama",
    TN: "Tennessee",
  };
  const matchesDz = (name: string) => dz === "ALL" || zones[dz] === name;
  const records = (state.flight_records || []).filter(
    (x) => x.flight_date === today && matchesDz(x.dz),
  );
  const schedules = (state.schedules || []).filter(
    (x) =>
      x.start_at.slice(0, 10) <= today &&
      x.end_at.slice(0, 10) >= today &&
      matchesDz(x.dz),
  );
  const fleet = (state.aircraft || []).filter((x) => matchesDz(x.dz));
  const squawks = (state.squawks || []).filter(
    (x) => x.status !== "Closed" && matchesDz(x.dz),
  );
  const mx = (state.maintenance || []).filter((x) =>
    fleet.some((a) => a.id === x.aircraft_id),
  );
  const maintenanceWatch = [...(state.maintenance || [])]
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        Overdue: 0,
        "Due soon": 1,
        OK: 2,
        Tracking: 3,
      };
      const statusDifference = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      if (statusDifference) return statusDifference;
      const urgencyDifference = Number(a.urgency_score ?? 1e12) - Number(b.urgency_score ?? 1e12);
      if (urgencyDifference) return urgencyDifference;
      return String(a.item).localeCompare(String(b.item));
    })
    .slice(0, 3);
  const loads = records.reduce((sum, x) => sum + Number(x.loads || 0), 0);
  const hours = records.reduce((sum, x) => sum + Number(x.total_time || 0), 0);
  const grounded = fleet.filter((x) => x.status === "Grounded");
  const pilotName = (id: string): string =>
    String((state.pilots || []).find((p) => p.id === id)?.name || "Unassigned");
  const aircraftFor = (id: string) =>
    (state.aircraft || []).find((a) => a.id === id);
  const liveOperations = records.length
    ? Array.from(
        records.reduce((groups, record) => {
          const current = groups.get(record.aircraft_id) || {
            id: `record-${record.aircraft_id}`,
            aircraft_id: record.aircraft_id,
            dz: record.dz,
            loads: 0,
            hours: 0,
            pilotIds: new Set<string>(),
            latest: "",
          };
          current.loads += Number(record.loads || 0);
          current.hours += Number(record.total_time || 0);
          current.pilotIds.add(record.pilot_id);
          if (String(record.created_at) >= current.latest) {
            current.latest = String(record.created_at);
            current.dz = record.dz;
          }
          groups.set(record.aircraft_id, current);
          return groups;
        }, new Map<string, any>()).values(),
      )
    : schedules.map((schedule) => ({
        ...schedule,
        loads: 0,
        hours: 0,
        pilotIds: new Set<string>(schedule.pilot_id ? [schedule.pilot_id] : []),
      }));
  return (
    <>
      <div className="dash-head">
        <div>
          <small>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </small>
          <h1>Good morning, Corey.</h1>
          <p>Here’s what’s happening across flight operations today.</p>
        </div>
        <div className="dz-tabs">
          {(["ALL", "GA", "AL", "TN"] as DZ[]).map((x) => (
            <button
              onClick={() => setDz(x)}
              className={dz === x ? "active" : ""}
            >
              {x === "ALL" ? "All drop zones" : x}
            </button>
          ))}
        </div>
      </div>
      {grounded.length > 0 && (
        <div className="alert">
          <TriangleAlert />
          <div>
            <b>{grounded.map((x) => x.tail).join(", ")} grounded</b>
            <span>Review aircraft status before scheduling.</span>
          </div>
          <button onClick={() => go("aircraft")}>
            View aircraft <ArrowUpRight />
          </button>
        </div>
      )}
      <div className="stats">
        <Stat
          label="Aircraft operating"
          value={`${fleet.filter((x) => ["Operating", "Available"].includes(x.status)).length}`}
          sub={`of ${fleet.length} fleet aircraft`}
          tone="green"
          Icon={Plane}
        />
        <Stat
          label="Pilots scheduled"
          value={`${new Set(schedules.map((x) => x.pilot_id)).size}`}
          sub={`${schedules.length} assignment(s)`}
          Icon={Users}
        />
        <Stat
          label="Loads today"
          value={`${loads}`}
          sub="from submitted records"
          tone="blue"
          Icon={CircleGauge}
        />
        <Stat
          label="Flight hours"
          value={hours.toFixed(1)}
          sub="across all zones"
          tone="blue"
          Icon={Clock3}
        />
        <Stat
          label="Open squawks"
          value={`${squawks.length}`}
          sub={`${squawks.filter((x) => x.severity === "Maintenance required").length} require maintenance`}
          tone="amber"
          Icon={TriangleAlert}
        />
        <Stat
          label="Due soon"
          value={`${mx.filter((x) => ["Due soon", "Overdue"].includes(x.status)).length}`}
          sub="due soon or overdue"
          tone="amber"
          Icon={Wrench}
        />
      </div>
      <div className="dashboard-grid">
        <Section
          title="Today’s operation"
          action={
            <button className="text-btn" onClick={() => go("schedule")}>
              Full schedule <ArrowUpRight />
            </button>
          }
        >
          <div className="operations">
            {liveOperations.map((o) => {
              const ac = aircraftFor(o.aircraft_id);
              const code = o.dz.slice(0, 2).toUpperCase();
              const pilotNames = Array.from(o.pilotIds as Set<string>).map(pilotName);
              return (
                <article key={o.id}>
                  <div className={`dz-mark dz-${code.toLowerCase()}`}>
                    {code}
                  </div>
                  <div className="op-main">
                    <div>
                      <small>Skydive {o.dz}</small>
                      <h3>
                        {ac?.tail || "No aircraft"}{" "}
                        <span>· {ac?.type || ""}</span>
                      </h3>
                    </div>
                    <Badge tone={ac?.status === "Grounded" ? "red" : "green"}>
                      {ac?.status || "Scheduled"}
                    </Badge>
                  </div>
                  <div className="pilot-line">
                    <div className="mini-avatar">
                      {(pilotNames[0] || "Unassigned")
                        .split(" ")
                        .map((x) => x[0])
                        .join("")}
                    </div>
                    <span>
                      <small>PILOT</small>
                      <b>{pilotNames.join(", ") || "Unassigned"}</b>
                    </span>
                    <span>
                      <small>LOADS</small>
                      <b>{o.loads || 0}</b>
                    </span>
                    <span>
                      <small>HOURS</small>
                      <b>{Number(o.hours || 0).toFixed(1)}</b>
                    </span>
                  </div>
                </article>
              );
            })}
            {!liveOperations.length && (
              <div className="empty-mini">
                <CalendarDays />
                <b>No pilots scheduled today</b>
              </div>
            )}
          </div>
        </Section>
        <div className="side-stack">
          <Section title="Maintenance watch">
            <div className="watch">
              {maintenanceWatch.map((m) => (
                <div key={m.id}>
                  <span
                    className={`dot ${m.status === "Overdue" ? "danger" : m.status === "Due soon" ? "warning" : "success"}`}
                  />
                  <p>
                    <b>{aircraftFor(m.aircraft_id)?.tail}</b> · {m.item}
                    <small>
                      {m.remaining_label || `${m.remaining} remaining`}
                    </small>
                  </p>
                  <ChevronDown />
                </div>
              ))}
              {!maintenanceWatch.length && (
                <div className="empty-mini"><Wrench /><b>No maintenance reminders</b></div>
              )}
            </div>
            <button className="full ghost" onClick={() => go("maintenance")}>
              View all maintenance
            </button>
          </Section>
          <Section title="Operational totals">
            <div className="empty-mini">
              <CircleGauge />
              <b>
                {loads} loads · {hours.toFixed(1)} hours today
              </b>
              <p>Calculated from submitted flight records.</p>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Schedule({
  items,
  pilots,
  aircraft,
  open,
  canEditPilot,
  canEditMaintenance,
}: {
  items: any[];
  pilots: any[];
  aircraft: any[];
  open: (v: any) => void;
  canEditPilot: boolean;
  canEditMaintenance: boolean;
}) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [today, setToday] = useState(localDate());
  const [clock, setClock] = useState(new Date());
  const [day, setDay] = useState(localDate());
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [aircraftFilter, setAircraftFilter] = useState("ALL");
  useEffect(() => {
    const updateToday = () => {
      setClock(new Date());
      const next = localDate();
      setToday((previous) => {
        if (previous !== next) setDay((selected) => selected === previous ? next : selected);
        return next;
      });
    };
    const timer = window.setInterval(updateToday, 60_000);
    document.addEventListener("visibilitychange", updateToday);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, []);
  const weekStart = addCalendarDays(day, -calendarDate(day).getDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i));
  const monthStart = `${day.slice(0, 7)}-01`;
  const monthOffset = calendarDate(monthStart).getDay();
  const daysInMonth = calendarDate(addCalendarDays(addCalendarMonths(monthStart, 1), -1)).getDate();
  const monthCells = Math.ceil((monthOffset + daysInMonth) / 7) * 7;
  const zones = zoneFilter === "ALL" ? ["Georgia", "Alabama", "Tennessee"] : [zoneFilter];
  const visibleItems = items.filter((x) =>
    (zoneFilter === "ALL" || x.dz === zoneFilter) &&
    (aircraftFilter === "ALL" || x.aircraft_id === aircraftFilter),
  );
  const pilotName = (id: string) =>
      pilots.find((p) => p.id === id)?.name || "Open position",
    tail = (id: string) =>
      aircraft.find((a) => a.id === id)?.tail || "No aircraft",
    activeOn = (x: any, date: string) =>
      x.start_at.slice(0, 10) <= date && x.end_at.slice(0, 10) >= date;
  const canEdit = (x: any) => x.kind === "maintenance" ? canEditMaintenance : canEditPilot;
  const newBooking = (date = day, dz = zoneFilter === "ALL" ? "Georgia" : zoneFilter, kind = "pilot") =>
    open({ kind, dz, date, aircraft_id: aircraftFilter === "ALL" ? "" : aircraftFilter });
  const event = (x: any, zi = 0) => (
    <article
      key={x.id}
      className={`event ${x.kind === "maintenance" ? "maintenance-event" : `e${zi}`} ${canEdit(x) ? "editable" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (canEdit(x)) open(x);
      }}
    >
      <b>{x.kind === "maintenance" ? "Maintenance" : pilotName(x.pilot_id)}</b>
      <span>{tail(x.aircraft_id)}{x.kind === "maintenance" && x.notes ? ` · ${x.notes}` : ""}</span>
    </article>
  );
  const move = (direction: number) => setDay((current) =>
    view === "day" ? addCalendarDays(current, direction) :
    view === "week" ? addCalendarDays(current, direction * 7) :
    addCalendarMonths(current, direction));
  return (
    <>
      <PageHead
        title="Flight schedule"
        desc={
          view === "day"
            ? calendarLabel(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : view === "week"
              ? `${calendarLabel(weekDates[0], { month: "short", day: "numeric" })}–${calendarLabel(weekDates[6], { month: "short", day: "numeric", year: "numeric" })}`
              : calendarLabel(day, { month: "long", year: "numeric" })
        }
        button={canEditPilot ? "New assignment" : undefined}
        onAction={canEditPilot ? () => newBooking() : undefined}
      />
      <div className="toolbar">
        <div className="seg">
          <button
            className={view === "day" ? "active" : ""}
            onClick={() => setView("day")}
          >
            Day
          </button>
          <button
            className={view === "week" ? "active" : ""}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={view === "month" ? "active" : ""}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
        <div className="calendar-navigation">
          <button type="button" onClick={() => move(-1)} aria-label={`Previous ${view}`}>‹</button>
          <button type="button" onClick={() => setDay(localDate())}>Today</button>
          <button type="button" onClick={() => move(1)} aria-label={`Next ${view}`}>›</button>
        </div>
        <input
          className="date-picker"
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <span className="schedule-clock">
          {clock.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </span>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
          <option value="ALL">All drop zones</option>
          <option value="Georgia">Georgia</option>
          <option value="Alabama">Alabama</option>
          <option value="Tennessee">Tennessee</option>
        </select>
        <select value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)}>
          <option value="ALL">All aircraft</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>{a.tail}</option>
          ))}
        </select>
        {canEditMaintenance && (
          <button type="button" className="ghost schedule-maintenance" onClick={() => newBooking(day, zoneFilter === "ALL" ? "Georgia" : zoneFilter, "maintenance")}>
            <Wrench size={15} /> Schedule maintenance
          </button>
        )}
      </div>
      {view === "week" && (
        <Section title={`Week of ${calendarLabel(weekStart, { month: "long", day: "numeric" })}`}>
          <div className="calendar">
            <div className="cal-head"></div>
            {weekDates.map((date) => (
              <div key={date} className={date === today ? "today" : ""}>
                <span>{calendarLabel(date, { weekday: "short", day: "numeric" }).toUpperCase()}</span>
              </div>
            ))}
            {zones.map((z, zi) => (
              <div className="calendar-row" key={z}>
                <div className="cal-zone">{z.toUpperCase()}</div>
                {weekDates.map((date) => {
                  const found = visibleItems.filter(
                    (x) => x.dz === z && activeOn(x, date),
                  );
                  return (
                    <button
                      className="cal-cell"
                      key={date}
                      onClick={() => canEditPilot && newBooking(date, z)}
                    >
                      {found.map((x) => event(x, zi))}
                      {!found.length && canEditPilot && (
                        <span className="add-slot">
                          <Plus /> Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Section>
      )}
      {view === "day" && (
        <Section
          title={calendarLabel(day, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        >
          <div className="day-view">
            {zones.map((z, zi) => {
              const found = visibleItems.filter((x) => x.dz === z && activeOn(x, day));
              return (
                <button key={z} onClick={() => canEditPilot && newBooking(day, z)}>
                  <div className={`dz-mark dz-${["ga", "al", "tn"][zi]}`}>
                    {["GA", "AL", "TN"][zi]}
                  </div>
                  <div className="day-zone">
                    <b>{z}</b>
                    <small>
                      {found.length} booking{found.length === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div className="day-events">
                    {found.map((x) => event(x, zi))}
                    {!found.length && canEditPilot && (
                      <span className="add-slot">
                        <Plus /> Add pilot
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      )}
      {view === "month" && (
        <Section title={calendarLabel(day, { month: "long", year: "numeric" })}>
          <div className="month-weekdays">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((x) => (
              <b key={x}>{x}</b>
            ))}
          </div>
          <div className="month-grid">
            {Array.from({ length: monthCells }, (_, i) => i).map((i) => {
              const n = i - monthOffset + 1;
              const valid = n >= 1 && n <= daysInMonth;
              const date = valid ? `${day.slice(0, 7)}-${String(n).padStart(2, "0")}` : "";
              const found = valid ? visibleItems.filter((x) => activeOn(x, date)) : [];
              return (
                <button
                  key={i}
                  disabled={!valid}
                  className={date === today ? "selected" : ""}
                  onClick={() => setDay(date)}
                >
                  {valid && (
                    <>
                      <span>{n}</span>
                      <div>
                        {found.slice(0, 3).map((x) => (
                          <i
                            key={x.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canEdit(x)) open(x);
                            }}
                          >
                            <em />
                            {x.kind === "maintenance" ? "MX" : pilotName(x.pilot_id).split(" ")[0]} ·{" "}
                            {tail(x.aircraft_id)}
                          </i>
                        ))}
                        {found.length > 3 && (
                          <small>+{found.length - 3} more</small>
                        )}
                        {!found.length && canEditPilot && (
                          <i
                            className="month-add"
                            onClick={(e) => { e.stopPropagation(); newBooking(date); }}
                          >
                            + Add pilot
                          </i>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}
      <p className="schedule-help">
        {canEditPilot || canEditMaintenance
          ? "Click a booking to edit or remove it. Use Schedule maintenance to reserve an aircraft for maintenance."
          : "Pilot and maintenance bookings are shown for each day."}
      </p>
    </>
  );
}
function Aircraft({
  items,
  open,
  inspect,
  readOnly = false,
}: {
  items: any[];
  open?: () => void;
  inspect: (a: any) => void;
  readOnly?: boolean;
}) {
  const list = (items.length ? items : aircraft).map((a: any) => ({
    ...a,
    tone:
      a.tone ||
      (["Grounded", "Maintenance"].includes(a.status) ? "red" : "green"),
  }));
  return (
    <>
      <PageHead
        title="Aircraft"
        desc="Fleet availability, location, and maintenance status"
        button={open ? "Add aircraft" : undefined}
        onAction={open}
      />
      <div className="summary-row">
        <Badge tone="green">
          {list.filter((a: any) => a.status !== "Grounded").length} available
        </Badge>
        <Badge tone="red">
          {list.filter((a: any) => a.status === "Grounded").length} grounded
        </Badge>
      </div>
      <div className="card-grid">
        {list.map((a: any) => (
          <button
            className={`entity-card aircraft-button${readOnly ? " read-only" : ""}`}
            key={a.id || a.tail}
            onClick={() => inspect(a)}
            aria-disabled={readOnly}
          >
            <div className="plane-art">
              {a.image_data ? (
                <img src={a.image_data} alt={a.tail} />
              ) : (
                <Plane />
              )}
              <Badge tone={a.tone}>{a.status}</Badge>
            </div>
            <small>{a.type.toUpperCase()}</small>
            <h2>{a.tail}</h2>
            <div className="entity-details">
              <span>
                <small>CURRENT DZ</small>
                {a.dz}
              </span>
              <span>
                <small>HOBBS</small>
                {Number(a.hobbs ?? a.time).toFixed(1)}
              </span>
              <span>
                <small>TTSN</small>
                {Number(a.ttsn ?? a.time).toFixed(1)} hr
              </span>
              <span>
                <small>TCSN</small>
                {Number(a.tcsn ?? a.cycles).toLocaleString()}
              </span>
            </div>
            <div className={`maint-strip ${colors[a.tone as Tone]}`}>
              <Wrench />
              <span>
                <small>OPEN MAINTENANCE</small>
                {a.maint}
              </span>
              <ArrowUpRight />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
function Pilots({ items, open }: { items: any[]; open: (p?: any) => void }) {
  const list = (items.length ? items : pilots).map((p: any) => ({
    ...p,
    initials:
      p.initials ||
      p.name
        .split(" ")
        .map((x: string) => x[0])
        .join(""),
    tone:
      p.tone ||
      (p.status === "Available"
        ? "blue"
        : p.status === "Weather hold"
          ? "amber"
          : "green"),
    until: p.until || p.until_text,
  }));
  return (
    <>
      <PageHead
        title="Pilots"
        desc="Crew availability, qualifications, and records"
        button="Add pilot"
        onAction={() => open()}
      />
      <div className="list-panel">
        <div className="list-tools">
          <div className="search">
            <Search />
            <input placeholder="Search pilots…" />
          </div>
          <select>
            <option>All home drop zones</option>
          </select>
        </div>
        {list.map((p: any) => (
          <button
            className="pilot-row pilot-button"
            key={p.id || p.name}
            onClick={() => open(p)}
          >
            <div className="big-avatar">{p.initials}</div>
            <div className="grow">
              <h3>{p.name}</h3>
              <p>
                {p.home} · {p.phone}
              </p>
            </div>
            <div className="pilot-flight">
              <small>FLIGHT HISTORY</small>
              <b>
                {Number(p.flight_stats?.flight_hours || 0).toFixed(1)} hr ·{" "}
                {p.flight_stats?.loads || 0} loads
              </b>
              <span>
                {p.flight_stats?.last_flight
                  ? `Last flight ${p.flight_stats.last_flight}`
                  : "No flights recorded"}
              </span>
            </div>
            <div className="qual">
              <small>MEDICAL / CURRENCY</small>
              <b>{p.medical_expiration || "Not entered"}</b>
              <span>Flight review: {p.flight_review_due || "Not entered"}</span>
            </div>
            <ArrowUpRight />
          </button>
        ))}
      </div>
    </>
  );
}
function Maintenance({
  aircraft: ac,
  items,
  engines,
  engineComponents,
  componentHistory,
  back,
  action,
  engineAction,
  componentAction,
  replaceComponent,
  update,
  remove,
}: {
  aircraft: any;
  items: any[];
  engines: any[];
  engineComponents: any[];
  componentHistory: any[];
  back: () => void;
  action: (x: any) => void;
  engineAction: (x?: any) => void;
  componentAction: (component: any, engine: any) => void;
  replaceComponent: (component: any, engine: any) => void;
  update: (id: string, d: any, msg: string) => void;
  remove: (id: string) => void;
}) {
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  if (!ac)
    return (
      <>
        <PageHead
          title="Maintenance"
          desc="Select an aircraft from the Aircraft page to manage its maintenance."
        />
        <div className="placeholder">
          <Wrench />
          <h2>No aircraft selected</h2>
          <p>Open the fleet and choose an aircraft.</p>
          <button className="primary" onClick={back}>
            View aircraft
          </button>
        </div>
      </>
    );
  const own = items.filter((x) => x.aircraft_id === ac.id);
  const aircraftEngines = engines.filter((engine) => engine.aircraft_id === ac.id);
  const aircraftEngineIds = new Set(aircraftEngines.map((engine) => engine.id));
  const lifeComponents = engineComponents.filter((component) => aircraftEngineIds.has(component.engine_id));
  const lifeHistory = componentHistory.filter((component) => aircraftEngineIds.has(component.engine_id));
  const limitingComponent = [...lifeComponents]
    .filter((component) => component.remaining_cycles != null)
    .sort((a, b) => Number(a.remaining_cycles) - Number(b.remaining_cycles))[0];
  const inspectionTemplates = Array.from(
    new Map(items.map((item) => [String(item.item).toLowerCase(), item])).values(),
  );
  const addFromTemplate = () => {
    const template: any = inspectionTemplates.find((item: any) => item.id === inspectionTemplateId);
    if (!template) return;
    action({
      item: template.item,
      component: template.component || "airframe",
      due_time_basis: template.due_time_basis || "ttsn",
      due_cycle_basis: template.due_cycle_basis || "tcsn",
      warning_hours: template.warning_hours,
      warning_days: template.warning_days,
      warning_cycles: template.warning_cycles,
      warning2_hours: template.warning2_hours,
      warning2_days: template.warning2_days,
      warning2_cycles: template.warning2_cycles,
      interval_hours: template.interval_hours,
      interval_days: template.interval_days,
      interval_months: template.interval_months,
      interval_cycles: template.interval_cycles,
    });
  };
  return (
    <>
      <button className="back-link" onClick={back}>
        ← Back to aircraft
      </button>
      <div className="mx-head">
        {ac.image_data && (
          <img className="mx-photo" src={ac.image_data} alt={ac.tail} />
        )}
        <div>
          <small>{ac.type.toUpperCase()}</small>
          <h1>{ac.tail}</h1>
          <p>
            Hobbs {Number(ac.hobbs ?? ac.time).toFixed(1)} · TTSN {Number(ac.ttsn ?? ac.time).toFixed(1)} · TCSN {Number(ac.tcsn ?? ac.cycles).toLocaleString()} · {ac.dz}
          </p>
        </div>
        <Badge tone={ac.status === "Grounded" ? "red" : "green"}>
          {ac.status}
        </Badge>
        <div className="mx-actions">
          <label className="photo-button">
            <Camera /> {ac.image_data ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file)
                  update(
                    ac.id,
                    { image_data: await fileToData(file) },
                    `${ac.tail} photo updated`,
                  );
              }}
            />
          </label>
          {ac.status === "Grounded" ? (
            <button
              className="approve"
              onClick={() =>
                update(
                  ac.id,
                  { status: "Available" },
                  `${ac.tail} returned to service`,
                )
              }
            >
              Return to service
            </button>
          ) : (
            <button
              className="ground-btn"
              onClick={() =>
                update(ac.id, { status: "Grounded" }, `${ac.tail} grounded`)
              }
            >
              <TriangleAlert /> Ground aircraft
            </button>
          )}
          <button className="primary" onClick={() => action(null)}>
            <Plus />
            Add maintenance item
          </button>
          {inspectionTemplates.length > 0 && <div className="inspection-picker">
            <select value={inspectionTemplateId} onChange={(e) => setInspectionTemplateId(e.target.value)}>
              <option value="">Select existing inspection…</option>
              {inspectionTemplates.map((template: any) => (
                <option key={template.id} value={template.id}>{template.item}</option>
              ))}
            </select>
            <button type="button" className="ghost" disabled={!inspectionTemplateId} onClick={addFromTemplate}>Add to {ac.tail}</button>
          </div>}
        </div>
      </div>
      <Section title="Aircraft information">
        <form
          className="tracking-form aircraft-info-form"
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            update(ac.id, { ...values, tail: String(values.tail).toUpperCase() }, `${ac.tail} information updated`);
          }}
        >
          <Field label="TAIL NUMBER"><input name="tail" required pattern="N[A-Za-z0-9]+" defaultValue={ac.tail} /></Field>
          <Field label="AIRCRAFT TYPE">
            <select name="type" required defaultValue={ac.type}>
              <option>PAC 750</option><option>Twin Otter</option><option>Caravan</option><option>King Air</option><option>Other</option>
            </select>
          </Field>
          <Field label="DROP ZONE">
            <select name="dz" required defaultValue={ac.dz}>
              <option>Georgia</option><option>Alabama</option><option>Tennessee</option>
            </select>
          </Field>
          <Field label="STATUS">
            <select name="status" required defaultValue={ac.status}>
              <option>Available</option><option>Maintenance</option><option>Grounded</option>
            </select>
          </Field>
          <button className="primary">Save aircraft information</button>
          {!confirmingRemoval ? (
            <button type="button" className="danger-link" onClick={() => setConfirmingRemoval(true)}>Remove aircraft</button>
          ) : (
            <div className="aircraft-remove-confirm">
              <small>Remove {ac.tail} from the active fleet?</small>
              <button type="button" className="danger-action" onClick={() => remove(ac.id)}>Yes, remove aircraft</button>
              <button type="button" className="ghost" onClick={() => setConfirmingRemoval(false)}>Cancel</button>
            </div>
          )}
        </form>
      </Section>
      <Section title="Aircraft tracking totals">
        <form
          className="tracking-form"
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const numeric = Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, value === "" ? null : Number(value)]),
            );
            update(ac.id, { ...numeric, time: numeric.hobbs, cycles: numeric.tcsn }, `${ac.tail} tracking totals updated`);
          }}
        >
          <Field label="HOBBS"><input name="hobbs" type="number" min="0" step=".1" required defaultValue={ac.hobbs ?? ac.time} /></Field>
          <Field label="TTSN"><input name="ttsn" type="number" min="0" step=".1" required defaultValue={ac.ttsn ?? ac.time} /></Field>
          <Field label="TCSN"><input name="tcsn" type="number" min="0" step="1" required defaultValue={ac.tcsn ?? ac.cycles} /></Field>
          {ac.type === "PAC 750" && <>
            <Field label="ENGINE TTSN"><input name="engine_ttsn" type="number" min="0" step=".1" required defaultValue={ac.engine_ttsn ?? ""} /></Field>
            <Field label="ENGINE TCSN"><input name="engine_tcsn" type="number" min="0" step="1" required defaultValue={ac.engine_tcsn ?? ""} /></Field>
            <Field label="ENGINE TTSOH"><input name="engine_ttsoh" type="number" min="0" step=".1" required defaultValue={ac.engine_ttsoh ?? ""} /></Field>
            <Field label="ENGINE TCSOH"><input name="engine_tcsoh" type="number" min="0" step="1" required defaultValue={ac.engine_tcsoh ?? ""} /></Field>
          </>}
          <button className="primary">Save tracking totals</button>
        </form>
      </Section>
      <Section
        title="Engine life limits"
        action={<button className="primary compact-action" onClick={() => engineAction()}><Plus /> Add engine</button>}
      >
        <div className="life-limit-disclaimer">
          <TriangleAlert />
          <span>
            <b>Maintenance tracking support only</b>
            <small>Reconcile every calculated value with current Pratt & Whitney documentation and approved aircraft maintenance records before making airworthiness decisions.</small>
          </span>
        </div>
        {limitingComponent && (
          <div className={`limiting-component ${limitingComponent.life_status === "Limit reached" ? "danger" : limitingComponent.life_status === "Approaching limit" ? "warning" : "success"}`}>
            <small>LIMITING COMPONENT</small>
            <b>{limitingComponent.description}</b>
            <span>{Number(limitingComponent.remaining_cycles).toFixed(1)} cycles remaining</span>
          </div>
        )}
        <div className="engine-life-list">
          {aircraftEngines.map((engine) => {
            const components = lifeComponents.filter((component) => component.engine_id === engine.id);
            return (
              <article className="engine-life-card" key={engine.id}>
                <header>
                  <div>
                    <small>{engine.position}</small>
                    <h3>{engine.model} · S/N {engine.serial_number}</h3>
                    <p>Tracking since {engine.tracking_start_date}</p>
                  </div>
                  <button className="ghost" onClick={() => engineAction(engine)}>Edit engine</button>
                  <button className="primary" onClick={() => componentAction(null, engine)}><Plus /> Add component</button>
                </header>
                <div className="engine-totals">
                  <span><small>TTSN</small><b>{Number(engine.current_ttsn).toFixed(1)}</b></span>
                  <span><small>CSN</small><b>{Number(engine.current_csn).toFixed(1)}</b></span>
                  <span><small>TTSOH</small><b>{Number(engine.current_ttsoh).toFixed(1)}</b></span>
                  <span><small>TCSOH</small><b>{Number(engine.current_tcsoh).toFixed(1)}</b></span>
                  <span><small>ENGINE STARTS</small><b>{Number(engine.total_starts).toLocaleString()}</b></span>
                  <span><small>FLIGHTS</small><b>{Number(engine.total_flights).toLocaleString()}</b></span>
                </div>
                <div className="life-component-table">
                  <div className="life-table-head"><span>Component</span><span>Current</span><span>Maximum</span><span>Remaining</span><span>Source</span><span /></div>
                  {components.map((component) => (
                    <div key={component.id} className="life-component-row">
                      <span>
                        <i className={`dot ${component.life_status === "Limit reached" ? "danger" : component.life_status === "Approaching limit" || component.life_status === "Unverified" ? "warning" : "success"}`} />
                        <b>{component.description}</b>
                        <small>P/N {component.part_number} · S/N {component.serial_number}</small>
                        <small>S {component.starts_since_baseline} · F {component.flights_since_baseline} · ACF {component.acf} · FCF {component.fcf}</small>
                      </span>
                      <b>{component.current_cycles == null ? "Review" : Number(component.current_cycles).toFixed(1)}</b>
                      <b>{Number(component.max_cycles).toFixed(1)}</b>
                      <span className="life-remaining">
                        <b>{component.remaining_cycles == null ? "—" : Number(component.remaining_cycles).toFixed(1)}</b>
                        <small>{component.percent_remaining == null ? "Not verified" : `${Number(component.percent_remaining).toFixed(1)}% life remaining`}</small>
                      </span>
                      <small className={component.verification_status === "Verified" ? "verified" : "unverified"}>{component.verification_status}</small>
                      <span className="life-actions">
                        <button className="ghost" onClick={() => componentAction(component, engine)}>Edit</button>
                        <button className="ghost" onClick={() => replaceComponent(component, engine)}>Replace</button>
                      </span>
                    </div>
                  ))}
                  {!components.length && <div className="empty-mini"><Wrench /><b>No life-limited components configured</b><p>Add only values supported by current approved documentation.</p></div>}
                </div>
              </article>
            );
          })}
          {!aircraftEngines.length && <div className="empty-mini"><CircleGauge /><b>No engines configured</b><p>Add each installed engine separately to begin life-limit tracking.</p></div>}
        </div>
        {lifeHistory.length > 0 && (
          <details className="component-history">
            <summary>Removed component history ({lifeHistory.length})</summary>
            {lifeHistory.map((component) => (
              <div key={component.id}>
                <b>{component.description} · S/N {component.serial_number}</b>
                <small>Removed {component.removed_at || component.archived_at} · {component.removed_details || "Archived"}</small>
              </div>
            ))}
          </details>
        )}
      </Section>
      <Section title="Maintenance items">
        <div className="maintenance-list">
          {own.map((m) => (
            <button className="mx-row" key={m.id} onClick={() => action(m)}>
              <span
                className={`status-bar ${m.status === "Overdue" ? "danger" : m.status === "Due soon" ? "warning" : "success"}`}
              />
              <div className="grow">
                <small>ITEM</small>
                <b>{m.item}</b>
                <small>
                  {m.component === "engine1"
                    ? "Engine 1"
                    : m.component === "engine2"
                      ? "Engine 2"
                      : m.component === "engine"
                        ? "Engine"
                        : "Airframe"}
                </small>
              </div>
              <div>
                <small>DUE</small>
                <b>{m.due}</b>
              </div>
              <div>
                <small>REMAINING</small>
                <b>{m.remaining_label || "No due limit set"}</b>
              </div>
              <ArrowUpRight />
            </button>
          ))}
          {!own.length && (
            <div className="empty-mini">
              <Wrench />
              <b>No maintenance items yet</b>
              <p>Add inspections, oil changes, or other tracked items.</p>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
function Squawks({
  items,
  aircraft,
  open,
}: {
  items: any[];
  aircraft: any[];
  open: (x?: any) => void;
}) {
  const groups = ["Open", "In Progress", "Deferred", "Closed"],
    tail = (id: string) =>
      aircraft.find((a) => a.id === id)?.tail || "Aircraft";
  return (
    <>
      <PageHead
        title="Aircraft squawks"
        desc="Pilots report discrepancies; maintenance reviews and closes them"
      />
      <div className="kanban">
        {groups.map((title, ci) => {
          const found = items.filter(
            (x) =>
              x.status.toLowerCase().replace("_", " ") === title.toLowerCase(),
          );
          return (
            <section key={title}>
              <header>
                <h3>{title.toUpperCase()}</h3>
                <span>{found.length}</span>
              </header>
              {found.map((x) => (
                <button
                  className="squawk-card"
                  key={x.id}
                  onClick={() => open(x)}
                >
                  <div>
                    <Badge
                      tone={
                        x.severity === "Aircraft grounded" ||
                        x.severity === "Maintenance required"
                          ? "red"
                          : "amber"
                      }
                    >
                      {x.severity}
                    </Badge>
                    <small>{x.created_at?.slice(0, 10)}</small>
                  </div>
                  <h3>{x.description}</h3>
                  <p>
                    {tail(x.aircraft_id)} · {x.dz}
                  </p>
                  <footer>
                    <span className="mini-avatar">MX</span>
                    <small>{x.status}</small>
                    <ArrowUpRight />
                  </footer>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
function Daily({
  open,
  upload,
  records,
  aircraft,
  pilots,
}: {
  open: (record?: any) => void;
  upload: () => void;
  records: any[];
  aircraft: any[];
  pilots: any[];
}) {
  const [today, setToday] = useState(localDate());
  const [selectedDate, setSelectedDate] = useState(localDate());
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = localDate();
      setToday((previous) => {
        if (selectedDate === previous) setSelectedDate(next);
        return next;
      });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [selectedDate]);
  const selectedRecords = records
    .filter((x) => x.flight_date === selectedDate)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const loads = selectedRecords.reduce(
    (sum, x) => sum + Number(x.loads || 0),
    0,
  );
  const hours = selectedRecords.reduce(
    (sum, x) => sum + Number(x.total_time || 0),
    0,
  );
  const cycles = selectedRecords.reduce(
    (sum, x) => sum + Number(x.total_cycles || 0),
    0,
  );
  const tail = (id: string) =>
    aircraft.find((x) => x.id === id)?.tail || "Unknown aircraft";
  const type = (id: string) => aircraft.find((x) => x.id === id)?.type || "";
  const pilot = (id: string) =>
    pilots.find((x) => x.id === id)?.name || "Unknown pilot";
  return (
    <>
      <PageHead
        title="Daily operations"
        desc="Flight and load records across all drop zones"
        button="Enter today’s flight record"
        onAction={open}
      />
      <div className="weekly-upload">
        <div>
          <Camera />
          <span>
            <b>Sunday weekly load sheet</b>
            <small>
              Photograph the completed weekly sheet and store it in Documents.
            </small>
          </span>
        </div>
        <button className="ghost" onClick={upload}>
          Upload load sheet
        </button>
      </div>
      <div className="daily-date-picker">
        <label>
          <span>OPERATING DATE</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
        {selectedDate !== today && (
          <button className="ghost" onClick={() => setSelectedDate(today)}>
            Return to today
          </button>
        )}
      </div>
      <div className="stats compact">
        <Stat
          label="Loads today"
          value={`${loads}`}
          sub={`${selectedRecords.length} record(s) submitted`}
          Icon={CircleGauge}
        />
        <Stat
          label="Flight hours"
          value={hours.toFixed(1)}
          sub={`across ${new Set(selectedRecords.map((x) => x.aircraft_id)).size} aircraft`}
          Icon={Clock3}
        />
        <Stat
          label="Cycles today"
          value={`${cycles}`}
          sub="from submitted records"
          tone="blue"
          Icon={ClipboardCheck}
        />
      </div>
      <Section
        title={`${new Date(`${selectedDate}T12:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} records`}
      >
        <div className="record-table">
          <div>
            <b>Aircraft</b>
            <b>Drop zone</b>
            <b>Pilot</b>
            <b>Time</b>
            <b>Cycles</b>
            <b>Loads</b>
            <b>Status</b>
          </div>
          {selectedRecords.map((record) => (
            <button
              type="button"
              className="record-row"
              key={record.id}
              onClick={() => open(record)}
              aria-label={`Edit flight record for ${tail(record.aircraft_id)}`}
            >
              <span>
                <b>{tail(record.aircraft_id)}</b>
                <small>{type(record.aircraft_id)}</small>
              </span>
              <span>{record.dz}</span>
              <span>{pilot(record.pilot_id)}</span>
              <span>{Number(record.total_time).toFixed(1)}</span>
              <span>{record.total_cycles || 0}</span>
              <span>{record.loads}</span>
              <Badge tone="green">Submitted</Badge>
            </button>
          ))}
          {!selectedRecords.length && (
            <div className="daily-empty">
              <ClipboardCheck />
              <span>
                <b>No flight records submitted today</b>
                <small>
                  Use “Enter today’s flight record” to add the first one.
                </small>
              </span>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
function TimeOff({ items, open }: { items: any[]; open: () => void }) {
  return (
    <>
      <PageHead
        title="Time off"
        desc="Requests and crew availability"
        button="Request time off"
        onAction={open}
      />
      <div className="split">
        <Section title="Pending requests">
          {items
            .filter((x) => x.status === "Pending")
            .map((x) => (
              <article className="request" key={x.id}>
                <div className="big-avatar">TO</div>
                <div className="grow">
                  <h3>{x.reason}</h3>
                  <p>
                    {x.start_date}–{x.end_date}
                  </p>
                  <small>{x.notes}</small>
                </div>
                <Badge tone="amber">Pending</Badge>
              </article>
            ))}
          {!items.some((x) => x.status === "Pending") && (
            <div className="empty-mini">
              <Check />
              <b>No pending requests</b>
            </div>
          )}
        </Section>
        <Section title="Upcoming approved">
          <div className="empty-mini">
            <Palmtree />
            <b>
              {items.filter((x) => x.status === "Approved").length} approved
              request(s)
            </b>
            <p>Scheduling conflicts are blocked automatically.</p>
          </div>
        </Section>
      </div>
    </>
  );
}
function Reports({ state }: { state: State }) {
  const [range, setRange] = useState("month");
  const [zone, setZone] = useState("All");
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const records = (state.flight_records || []).filter(
    (x) =>
      (range === "all" || x.flight_date.startsWith(month)) &&
      (zone === "All" || x.dz === zone),
  );
  const totalLoads = records.reduce((s, x) => s + Number(x.loads || 0), 0);
  const totalHours = records.reduce((s, x) => s + Number(x.total_time || 0), 0);
  const days = new Set(records.map((x) => x.flight_date)).size;
  const activePilots = new Set(records.map((x) => x.pilot_id)).size;
  const byZone = ["Georgia", "Alabama", "Tennessee"].map((name) => ({
    name,
    loads: records
      .filter((x) => x.dz === name)
      .reduce((s, x) => s + Number(x.loads || 0), 0),
  }));
  const maxLoads = Math.max(1, ...byZone.map((x) => x.loads));
  const exportCsv = () => {
    const header = "Date,Drop Zone,Aircraft,Pilot,Flight Hours,Cycles,Loads";
    const rows = records.map((x) =>
      [
        x.flight_date,
        x.dz,
        (state.aircraft || []).find((a) => a.id === x.aircraft_id)?.tail || "",
        (state.pilots || []).find((p) => p.id === x.pilot_id)?.name || "",
        x.total_time,
        x.total_cycles || 0,
        x.loads,
      ].join(","),
    );
    const url = URL.createObjectURL(
      new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sdg-operations-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHead
        title="Reports"
        desc="Operational performance and utilization"
        button="Export CSV"
        Icon={FileText}
        onAction={exportCsv}
      />
      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
        <select value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="All">All drop zones</option>
          <option>Georgia</option>
          <option>Alabama</option>
          <option>Tennessee</option>
        </select>
      </div>
      <div className="report-grid">
        <Section title="Loads by drop zone">
          <div className="bars">
            {byZone.map((x) => (
              <div key={x.name}>
                <span>
                  <b>{x.name}</b>
                  <strong>{x.loads}</strong>
                </span>
                <i>
                  <em style={{ width: `${(x.loads / maxLoads) * 100}%` }} />
                </i>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Operations overview">
          <div className="big-metrics">
            <div>
              <small>TOTAL LOADS</small>
              <b>{totalLoads}</b>
              <span>From {records.length} records</span>
            </div>
            <div>
              <small>FLIGHT HOURS</small>
              <b>{totalHours.toFixed(1)}</b>
              <span>Submitted aircraft time</span>
            </div>
            <div>
              <small>DAYS OPERATED</small>
              <b>{days}</b>
              <span>Unique operating dates</span>
            </div>
            <div>
              <small>ACTIVE PILOTS</small>
              <b>{activePilots}</b>
              <span>With submitted records</span>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
function Documents({ items, remove }: { items: any[]; remove: (id: string) => void }) {
  const loadSheets = items.filter((x) => x.folder === "Load Sheets");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const closeViewer = () => {
    setSelectedDocument(null);
    setConfirmingDelete(false);
  };
  return (
    <>
      <PageHead
        title="Documents"
        desc="Operational documents organized by folder"
      />
      <Section title={`Load Sheets (${loadSheets.length})`}>
        <div className="document-grid">
          {loadSheets.map((doc) => (
            <button
              key={doc.id}
              className="document-card"
              onClick={() => {
                setSelectedDocument(doc);
                setConfirmingDelete(false);
              }}
            >
              <img src={doc.image_data} alt={doc.file_name} />
              <span>
                <b>Week ending {doc.week_ending}</b>
                <small>{doc.file_name}</small>
              </span>
              <ArrowUpRight />
            </button>
          ))}
          {!loadSheets.length && (
            <div className="empty-mini">
              <FolderOpen />
              <b>No weekly load sheets uploaded</b>
            </div>
          )}
        </div>
      </Section>
      {selectedDocument && (
        <ModalShell
          title={`Load sheet · ${selectedDocument.week_ending || selectedDocument.file_name}`}
          desc={selectedDocument.file_name}
          close={closeViewer}
        >
          <div className="document-viewer">
            <img src={selectedDocument.image_data} alt={selectedDocument.file_name} />
          </div>
          <div className="modal-actions">
            {confirmingDelete ? (
              <>
                <span className="delete-confirm">Delete this document?</span>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    const id = selectedDocument.id;
                    closeViewer();
                    remove(id);
                  }}
                >
                  Yes, delete
                </button>
                <button type="button" className="ghost" onClick={() => setConfirmingDelete(false)}>Keep document</button>
              </>
            ) : (
              <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>Delete document</button>
            )}
            <button type="button" className="primary" onClick={closeViewer}>Close</button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
const roleLabel = (role: string) =>
  ({
    administrator: "Administrator",
    chief_pilot: "Chief Pilot",
    maintenance: "Maintenance",
    drop_zone_manager: "Drop Zone Manager",
    pilot: "Pilot",
  })[role] || role;
const roleDescription = (role: string) =>
  ({
    administrator: "Full access, including accounts and permissions",
    chief_pilot: "Pilots, schedules, time-off approvals, and flight records",
    maintenance: "Aircraft, maintenance items, squawks, and documents",
    drop_zone_manager: "Aircraft and scheduling for operations",
    pilot: "Own daily records, squawks, documents, and time off",
  })[role] || "";
function Login({
  error,
  submit,
}: {
  error: string;
  submit: (email: string, password: string) => void;
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Plane />
          <span>
            <b>SDG</b>
            <small>FLIGHT OPERATIONS</small>
          </span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to manage flight operations.</p>
        {error && <div className="form-error">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(String(f.get("email")), String(f.get("password")));
          }}
        >
          <Field label="EMAIL">
            <input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="PASSWORD">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <button className="primary" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
function Admin({
  users,
  pilots,
  open,
}: {
  users: any[];
  pilots: any[];
  open: (user?: any) => void;
}) {
  return (
    <>
      <PageHead
        title="Admin"
        desc="Accounts, roles, and access privileges"
        button="Create account"
        onAction={() => open()}
      />
      <div className="admin-summary">
        <Stat
          label="Accounts"
          value={`${users.length}`}
          sub={`${users.filter((x) => x.active).length} active`}
          Icon={Users}
        />
        <Stat
          label="Administrators"
          value={`${users.filter((x) => x.role === "administrator" && x.active).length}`}
          sub="Full system access"
          Icon={ShieldCheck}
          tone="green"
        />
      </div>
      <Section title="User accounts">
        <div className="account-list">
          {users.map((user) => (
            <button key={user.id} onClick={() => open(user)}>
              <span className="big-avatar">
                {user.name
                  .split(" ")
                  .map((x: string) => x[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="account-person">
                <b>{user.name}</b>
                <small>{user.email}</small>
              </span>
              <span>
                <b>{roleLabel(user.role)}</b>
                <small>{roleDescription(user.role)}</small>
              </span>
              <Badge tone={user.active ? "green" : "gray"}>
                {user.active ? "Active" : "Disabled"}
              </Badge>
              <span className="account-edit">Edit</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Role privileges">
        <div className="role-grid">
          {[
            "administrator",
            "chief_pilot",
            "maintenance",
            "drop_zone_manager",
            "pilot",
          ].map((role) => (
            <article key={role}>
              <ShieldCheck />
              <b>{roleLabel(role)}</b>
              <p>{roleDescription(role)}</p>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
function AccountModal({
  value,
  pilots,
  close,
  submit,
}: {
  value?: any;
  pilots: any[];
  close: () => void;
  submit: (d: any) => void;
}) {
  const [role, setRole] = useState(value?.role || "pilot");
  return (
    <ModalShell
      title={value ? "Edit account" : "Create account"}
      desc="Set login details and system privileges."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f: any = Object.fromEntries(new FormData(e.currentTarget));
          submit({
            ...f,
            role,
            active: f.active ? 1 : 0,
            password: f.password || undefined,
          });
        }}
      >
        <div className="form-grid">
          <Field label="FULL NAME">
            <input name="name" required defaultValue={value?.name || ""} />
          </Field>
          <Field label="EMAIL">
            <input
              name="email"
              type="email"
              required
              defaultValue={value?.email || ""}
            />
          </Field>
          <Field label="ROLE" wide>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {[
                "administrator",
                "chief_pilot",
                "maintenance",
                "drop_zone_manager",
                "pilot",
              ].map((x) => (
                <option key={x} value={x}>
                  {roleLabel(x)}
                </option>
              ))}
            </select>
            <small>{roleDescription(role)}</small>
          </Field>
          <Field label="LINKED PILOT PROFILE" wide>
            <select name="pilot_id" defaultValue={value?.pilot_id || ""}>
              <option value="">No linked pilot</option>
              {pilots.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={value ? "RESET PASSWORD (OPTIONAL)" : "TEMPORARY PASSWORD"}
            wide
          >
            <input
              name="password"
              type="password"
              required={!value}
              minLength={10}
              placeholder={
                value
                  ? "Leave blank to keep current password"
                  : "At least 10 characters"
              }
            />
          </Field>
          <label className="account-active wide">
            <input
              name="active"
              type="checkbox"
              defaultChecked={value ? Boolean(value.active) : true}
            />
            <span>
              <b>Account active</b>
              <small>Disabled accounts cannot sign in.</small>
            </span>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={close}>
            Cancel
          </button>
          <button className="primary">
            <ShieldCheck />
            {value ? "Save account" : "Create account"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
function Placeholder({ page }: { page: Page }) {
  return (
    <>
      <PageHead
        title={page[0].toUpperCase() + page.slice(1)}
        desc="Organization records and administration"
        button="Add record"
      />
      <div className="placeholder">
        <FolderOpen />
        <h2>
          {page === "admin" ? "System administration" : "Document library"}
        </h2>
        <p>
          {page === "admin"
            ? "Manage users, roles, drop zones, settings, and audit logs."
            : "Securely manage operational files and metadata."}
        </p>
        <button className="primary">Open module</button>
      </div>
    </>
  );
}
function ModalShell({
  title,
  desc,
  close,
  children,
}: {
  title: string;
  desc: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-wrap">
      <div className="modal">
        <header>
          <div>
            <small>QUICK ENTRY</small>
            <h2>{title}</h2>
            <p>{desc}</p>
          </div>
          <button className="icon" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function DayModal({
  value,
  close,
  submit,
  aircraft: acs,
  engines,
  remove,
}: {
  value?: any;
  close: () => void;
  submit: (d: any) => void;
  aircraft: any[];
  engines: any[];
  remove?: () => void;
}) {
  const [aircraftId, setAircraftId] = useState(value?.aircraft_id || ""),
    [dropZone, setDropZone] = useState(value?.dz || ""),
    [end, setEnd] = useState(String(value?.end_time ?? "")),
    [startTime, setStartTime] = useState(Number(value?.start_time ?? 0)),
    [startCycles, setStartCycles] = useState(Number(value?.start_cycles ?? 0)),
    [squawk, setSquawk] = useState(false),
    [confirmingDelete, setConfirmingDelete] = useState(false);
  const ac = acs.find((a) => a.id === aircraftId),
    availableEngines = engines.filter((engine) => engine.aircraft_id === aircraftId && engine.status === "Active"),
    primaryEngine = availableEngines[0],
    start = startTime,
    total = end ? Math.max(0, Number(end) - start).toFixed(1) : "0.0",
    counterDelta = Number(total) - Number(value?.total_time || 0),
    projectedTtsn = Number(ac?.ttsn ?? ac?.time ?? 0) + counterDelta;
  useEffect(() => {
    if (value?.id || !ac) return;
    const latestHobbs = Number(ac.hobbs ?? ac.time ?? 0);
    const latestCycles = Number(ac.tcsn ?? ac.cycles ?? 0);
    if (latestHobbs !== startTime) {
      setEnd((current) => {
        if (!current) return String(latestHobbs);
        const enteredDuration = Math.max(0, Number(current) - startTime);
        return String(+(latestHobbs + enteredDuration).toFixed(1));
      });
      setStartTime(latestHobbs);
    }
    if (latestCycles !== startCycles) setStartCycles(latestCycles);
  }, [ac?.hobbs, ac?.time, ac?.tcsn, ac?.cycles, value?.id]);
  return (
    <ModalShell
      title={value ? "Edit daily flight record" : "Enter today’s flight record"}
      desc={
        value
          ? "Update this entry. Aircraft totals will be corrected automatically."
          : "Current aircraft totals are filled automatically."
      }
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)),
            cycles = Number(f.cycles),
            loads = Number(f.loads),
            engineOperations = availableEngines.map((engine) => ({
              engine_id: engine.id,
              starts: cycles,
              flights: loads,
            }));
          submit({
            ...f,
            aircraft_id: aircraftId,
            pilot_id: "p1",
            dz: dropZone,
            flight_date: String(f.flight_date),
            start_time: start,
            start_cycles: startCycles,
            end_cycles: startCycles + cycles,
            engine_operations: engineOperations,
            squawk_description: squawk ? f.squawk_description : null,
            squawk_severity: squawk ? "Information" : null,
          });
        }}
      >
        <div className="form-grid">
          <Field label="OPERATING DATE" wide>
            <input
              name="flight_date"
              type="date"
              required
              defaultValue={value?.flight_date || localDate()}
            />
          </Field>
          <Field label="AIRCRAFT" wide>
            <select
              required
              value={aircraftId}
              onChange={(e) => {
                setAircraftId(e.target.value);
                const next = acs.find((a) => a.id === e.target.value);
                setDropZone(next?.dz || "");
                setEnd(String(next?.hobbs ?? next?.time ?? ""));
                setStartTime(Number(next?.hobbs ?? next?.time ?? 0));
                setStartCycles(Number(next?.tcsn ?? next?.cycles ?? 0));
              }}
            >
              <option value="" disabled>
                Select an aircraft
              </option>
              {acs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail} · {a.type} · {a.dz}
                </option>
              ))}
            </select>
          </Field>
          <Field label="DROP ZONE" wide>
            <select required value={dropZone} onChange={(e) => setDropZone(e.target.value)}>
              <option value="" disabled>Select a drop zone</option>
              <option>Georgia</option>
              <option>Alabama</option>
              <option>Tennessee</option>
            </select>
          </Field>
          <div className="current-values">
            <span>
              <small>STARTING HOBBS</small>
              <b>{start.toFixed(1)}</b>
            </span>
            <span>
              <small>STARTING TCSN</small>
              <b>{startCycles}</b>
            </span>
          </div>
          <Field label="ENDING HOBBS">
            <input
              name="end_time"
              required
              min={start}
              type="number"
              step=".1"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <div className="calculated">
            <Clock3 />
            <span>
              <small>FLIGHT TIME TODAY</small>
              <b>{total} hours</b>
            </span>
          </div>
          {ac && <div className="current-values wide">
            <span><small>NEW TTSN</small><b>{projectedTtsn.toFixed(1)}</b></span>
            {ac.type === "PAC 750" && <>
              <span><small>ENGINE TTSN</small><b>{(Number(primaryEngine?.current_ttsn ?? ac.engine_ttsn ?? 0) + counterDelta).toFixed(1)}</b></span>
              <span><small>ENGINE TTSOH</small><b>{(Number(primaryEngine?.current_ttsoh ?? ac.engine_ttsoh ?? 0) + counterDelta).toFixed(1)}</b></span>
            </>}
          </div>}
          <Field label="NUMBER OF LOADS">
            <input
              name="loads"
              defaultValue={value?.loads ?? ""}
              required
              min="0"
              type="number"
              inputMode="numeric"
            />
          </Field>
          <Field label="CYCLES TODAY">
            <input
              name="cycles"
              defaultValue={value?.total_cycles ?? ""}
              required
              min="0"
              type="number"
              inputMode="numeric"
            />
          </Field>
          {availableEngines.length > 0 && (
            <div className="both-note wide">
              <CircleGauge />
              <span><b>Engine totals update automatically</b><small>Loads update engine flights, Cycles Today updates engine starts and cycle totals, and the Hobbs change updates engine hours for every installed engine.</small></span>
            </div>
          )}
          <Field label="NOTES" wide>
            <textarea
              name="notes"
              defaultValue={value?.notes || ""}
              placeholder="Optional operational notes"
            />
          </Field>
          <div className="squawk-toggle wide">
            <label>
              <input
                type="checkbox"
                checked={squawk}
                onChange={(e) => setSquawk(e.target.checked)}
              />
              <span>
                <TriangleAlert />
                <b>Create an information squawk</b>
                <small>
                  Add an aircraft note to the maintenance squawk list
                </small>
              </span>
            </label>
            {squawk && (
              <div className="inline-squawk">
                <div className="calculated">
                  <TriangleAlert />
                  <span>
                    <small>SQUAWK TYPE</small>
                    <b>Information</b>
                  </span>
                </div>
                <Field label="SQUAWK DESCRIPTION">
                  <textarea
                    name="squawk_description"
                    required
                    placeholder="Describe the aircraft issue…"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          {remove && (confirmingDelete ? (
            <>
              <span className="delete-confirm">Delete this daily operation entry?</span>
              <button type="button" className="danger-action" onClick={remove}>Yes, delete</button>
              <button type="button" className="ghost" onClick={() => setConfirmingDelete(false)}>Keep entry</button>
            </>
          ) : (
            <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>Delete entry</button>
          ))}
          <button type="button" className="ghost" onClick={close}>
            Cancel
          </button>
          <button className="primary">
            <ClipboardCheck />
            {value ? "Save changes" : "Submit flight record"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
function SquawkModal({
  value,
  close,
  submit,
  deleteSquawk,
  aircraft: acs,
}: {
  value?: any;
  close: () => void;
  submit: (d: any) => void;
  deleteSquawk?: () => void;
  aircraft: any[];
}) {
  const editing = Boolean(value?.id);
  const [status, setStatus] = useState(value?.status || "Open");
  return (
    <ModalShell
      title={editing ? "Squawk details" : "Report an aircraft squawk"}
      desc={
        editing
          ? "Maintenance review and corrective action."
          : "Pilots can report a discrepancy from the field."
      }
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({
            ...Object.fromEntries(new FormData(e.currentTarget)),
            ...(editing ? {} : { pilot_id: "p1" }),
          });
        }}
      >
        <div className="form-grid">
          <Field label="AIRCRAFT">
            <select
              name="aircraft_id"
              required
              defaultValue={value?.aircraft_id || ""}
              disabled={editing}
            >
              <option value="" disabled>
                Select aircraft
              </option>
              {acs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail} · {a.type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="DROP ZONE">
            <select
              name="dz"
              defaultValue={value?.dz || "Georgia"}
              disabled={editing}
            >
              <option>Georgia</option>
              <option>Alabama</option>
              <option>Tennessee</option>
            </select>
          </Field>
          <Field label="SEVERITY" wide>
            <div className="severity">
              {[
                "Information",
                "Monitor",
                "Maintenance required",
                "Aircraft grounded",
              ].map((s, i) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="severity"
                    value={s}
                    defaultChecked={value?.severity ? s === value.severity : !i}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="DESCRIPTION" wide>
            <textarea
              name="description"
              required
              defaultValue={value?.description || ""}
              placeholder="Describe the discrepancy clearly…"
            />
          </Field>
          <Field label="AIRCRAFT TIME">
            <input
              name="aircraft_time"
              type="number"
              step=".1"
              defaultValue={value?.aircraft_time || ""}
            />
          </Field>
          {editing && (
            <Field label="MAINTENANCE STATUS">
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>Open</option>
                <option>In Progress</option>
                <option>Deferred</option>
                <option>Closed</option>
              </select>
            </Field>
          )}
          {editing && (
            <Field label="CORRECTIVE ACTION" wide>
              <textarea
                name="corrective_action"
                defaultValue={value.corrective_action || ""}
                placeholder="Inspection performed, repair completed, or reason deferred…"
              />
            </Field>
          )}
        </div>
        <div className="modal-actions">
          {editing && status === "Closed" && deleteSquawk && (
            <button
              type="button"
              className="delete-squawk"
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this completed squawk from the active list? Its audit history will be kept.",
                  )
                )
                  deleteSquawk();
              }}
            >
              Delete squawk
            </button>
          )}
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
          <button className={editing ? "primary" : "primary danger-btn"}>
            {editing ? "Save maintenance update" : "Submit squawk"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
function SimpleForm({
  title,
  close,
  submit,
  children,
  destructiveAction,
}: {
  title: string;
  close: () => void;
  submit: (d: any) => void;
  children: React.ReactNode;
  destructiveAction?: React.ReactNode;
}) {
  return (
    <ModalShell
      title={title}
      desc="Required fields are marked by your browser."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <div className="form-grid">{children}</div>
        <div className="modal-actions">
          {destructiveAction}
          <button type="button" className="ghost" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    </ModalShell>
  );
}
function PilotModal({
  value,
  close,
  submit,
}: {
  value?: any;
  close: () => void;
  submit: (d: any) => void;
}) {
  const stats = value?.flight_stats,
    [confirming, setConfirming] = useState(false);
  return (
    <ModalShell
      title={value?.id ? value.name : "Add pilot"}
      desc={
        value?.id
          ? "Edit contact, medical, and currency information."
          : "Create a pilot profile."
      }
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          submit({
            ...d,
            status: value?.status || "Available",
            qual: "Current",
            until_text: "Current",
            active: 1,
          });
        }}
      >
        {value?.id && (
          <div className="pilot-history">
            <div>
              <small>FLIGHT HOURS</small>
              <b>{Number(stats?.flight_hours || 0).toFixed(1)}</b>
            </div>
            <div>
              <small>LOADS FLOWN</small>
              <b>{stats?.loads || 0}</b>
            </div>
            <div>
              <small>DAYS FLOWN</small>
              <b>{stats?.days_flown || 0}</b>
            </div>
            <div>
              <small>LAST FLIGHT</small>
              <b>{stats?.last_flight || "—"}</b>
            </div>
          </div>
        )}
        <div className="form-grid">
          <Field label="FULL NAME">
            <input name="name" required defaultValue={value?.name || ""} />
          </Field>
          <Field label="EMAIL">
            <input
              name="email"
              type="email"
              required
              defaultValue={value?.email || ""}
            />
          </Field>
          <Field label="PHONE">
            <input
              name="phone"
              type="tel"
              required
              defaultValue={value?.phone || ""}
            />
          </Field>
          <Field label="HOME DROP ZONE">
            <select name="home" defaultValue={value?.home || "Georgia"}>
              <option>Georgia</option>
              <option>Alabama</option>
              <option>Tennessee</option>
            </select>
          </Field>
          <Field label="MEDICAL CLASS">
            <select
              name="medical_class"
              defaultValue={value?.medical_class || ""}
            >
              <option value="">Not entered</option>
              <option>First Class</option>
              <option>Second Class</option>
              <option>Third Class</option>
            </select>
          </Field>
          <Field label="MEDICAL EXPIRATION">
            <input
              name="medical_expiration"
              type="date"
              defaultValue={value?.medical_expiration || ""}
            />
          </Field>
          <Field label="FLIGHT REVIEW DUE">
            <input
              name="flight_review_due"
              type="date"
              defaultValue={value?.flight_review_due || ""}
            />
          </Field>
          <Field label="CERTIFICATE TYPE">
            <select
              name="certificate_type"
              defaultValue={value?.certificate_type || ""}
            >
              <option value="">Not entered</option>
              <option>Commercial</option>
              <option>ATP</option>
            </select>
          </Field>
          <Field label="NOTES" wide>
            <textarea name="notes" defaultValue={value?.notes || ""} />
          </Field>
        </div>
        <div className="modal-actions">
          {value?.id &&
            (confirming ? (
              <>
                <span className="delete-confirm">Archive {value.name}?</span>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() =>
                    submit({ archived_at: new Date().toISOString(), active: 0 })
                  }
                >
                  Yes, delete pilot
                </button>
              </>
            ) : (
              <button
                type="button"
                className="danger-link"
                onClick={() => setConfirming(true)}
              >
                Delete pilot
              </button>
            ))}
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
          <button className="primary">
            {value?.id ? "Save profile" : "Add pilot"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
function AircraftModal({
  close,
  submit,
}: {
  close: () => void;
  submit: (d: any) => void;
}) {
  const [aircraftType, setAircraftType] = useState("PAC 750");
  return (
    <ModalShell
      title="Add aircraft"
      desc="Add the aircraft details and an optional photo."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget),
            file = form.get("photo") as File,
            number = (name: string) => Number(form.get(name));
          submit({
            tail: String(form.get("tail")).toUpperCase(),
            type: aircraftType,
            time: number("hobbs"),
            hobbs: number("hobbs"),
            ttsn: number("ttsn"),
            tcsn: number("tcsn"),
            cycles: number("tcsn"),
            ...(aircraftType === "PAC 750" ? {
              engine_ttsn: number("engine_ttsn"),
              engine_tcsn: number("engine_tcsn"),
              engine_ttsoh: number("engine_ttsoh"),
              engine_tcsoh: number("engine_tcsoh"),
            } : {}),
            dz: "Georgia",
            status: "Available",
            maint: "Current",
            image_data: file?.size ? await fileToData(file) : null,
          });
        }}
      >
        <div className="form-grid">
          <Field label="TAIL NUMBER">
            <input
              name="tail"
              required
              pattern="N[A-Za-z0-9]+"
              placeholder="N123AB"
            />
          </Field>
          <Field label="AIRCRAFT TYPE">
            <select name="type" required value={aircraftType} onChange={(e) => setAircraftType(e.target.value)}>
              <option>PAC 750</option>
              <option>Twin Otter</option>
              <option>Caravan</option>
              <option>King Air</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="STARTING HOBBS"><input name="hobbs" required type="number" min="0" step=".1" placeholder="0.0" /></Field>
          <Field label="STARTING TTSN"><input name="ttsn" required type="number" min="0" step=".1" placeholder="0.0" /></Field>
          <Field label="STARTING TCSN"><input name="tcsn" required type="number" min="0" step="1" placeholder="0" /></Field>
          {aircraftType === "PAC 750" && <>
            <Field label="ENGINE TTSN"><input name="engine_ttsn" required type="number" min="0" step=".1" /></Field>
            <Field label="ENGINE TCSN"><input name="engine_tcsn" required type="number" min="0" step="1" /></Field>
            <Field label="ENGINE TTSOH"><input name="engine_ttsoh" required type="number" min="0" step=".1" /></Field>
            <Field label="ENGINE TCSOH"><input name="engine_tcsoh" required type="number" min="0" step="1" /></Field>
          </>}
          <Field label="AIRCRAFT PHOTO">
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={close}>
            Cancel
          </button>
          <button className="primary">Add aircraft</button>
        </div>
      </form>
    </ModalShell>
  );
}
const fileToData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (file.size > 3_000_000)
      return reject(new Error("Image must be smaller than 3 MB"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
const loadSheetImageToData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/"))
      return reject(new Error("Choose a photo or image of the load sheet"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the load sheet photo"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("This image format could not be opened. Try a JPEG or PNG photo."));
      image.onload = () => {
        const maxDimension = 2200,
          scale = Math.min(1, maxDimension / Math.max(image.width, image.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Could not prepare the load sheet image"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.82);
        if (data.length > 6_500_000)
          return reject(new Error("The compressed load sheet is still too large. Retake the photo at a lower resolution."));
        resolve(data);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
function TimeOffModal({
  close,
  submit,
}: {
  close: () => void;
  submit: (d: any) => void;
}) {
  return (
    <SimpleForm
      title="Request time off"
      close={close}
      submit={(d) =>
        submit({
          ...d,
          pilot_id: "p1",
          status: "Pending",
          created_at: new Date().toISOString(),
        })
      }
    >
      <div className="account-lock wide">
        <ShieldCheck />
        <span>
          <b>Corey Anderson</b>
          <small>This request is tied to your pilot account.</small>
        </span>
      </div>
      <Field label="REASON">
        <input name="reason" required />
      </Field>
      <Field label="START DATE">
        <input name="start_date" type="date" required />
      </Field>
      <Field label="END DATE">
        <input name="end_date" type="date" required />
      </Field>
      <Field label="NOTES" wide>
        <textarea name="notes" />
      </Field>
    </SimpleForm>
  );
}
function LoadSheetModal({
  close,
  submit,
}: {
  close: () => void;
  submit: (d: any) => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState(false);
  const latestSunday = new Date();
  latestSunday.setDate(latestSunday.getDate() - latestSunday.getDay());
  return (
    <ModalShell
      title="Upload weekly load sheet"
      desc="Upload the completed sheet after the week ends on Sunday."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const uploadForm = e.currentTarget;
          setFieldError(uploadForm, "");
          try {
            setUploading(true);
            const form = new FormData(uploadForm),
              file = form.get("photo") as File,
              weekEnding = String(form.get("week_ending")),
              parsed = new Date(`${weekEnding}T12:00:00`);
            if (!file?.size) throw new Error("Choose a load sheet photo");
            if (parsed.getDay() !== 0)
              throw new Error("Week ending must be a Sunday");
            if (parsed.getTime() > Date.now())
              throw new Error("The weekly sheet can be uploaded on or after that Sunday");
            const baseName = file.name.replace(/\.[^.]+$/, "") || "load-sheet";
            await submit({
              folder: "Load Sheets",
              file_name: `${baseName}.jpg`,
              mime_type: "image/jpeg",
              image_data: await loadSheetImageToData(file),
              week_ending: weekEnding,
              uploaded_by: "current-account",
              created_at: new Date().toISOString(),
            });
          } catch (error: any) {
            setFieldError(uploadForm, error.message || "The load sheet could not be uploaded");
          } finally {
            setUploading(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="WEEK ENDING SUNDAY">
            <input name="week_ending" type="date" required defaultValue={localDate(latestSunday)} />
          </Field>
          <Field label="LOAD SHEET PHOTO">
            <input
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
              required
            />
          </Field>
          <p className="field-message wide" aria-live="polite" />
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={uploading}>
            <FolderOpen /> {uploading ? "Preparing photo…" : "Store in Documents"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
function setFieldError(form: HTMLFormElement, message: string) {
  const target = form.querySelector(".field-message");
  if (target) target.textContent = message;
}
function AssignmentModal({
  value,
  pilots,
  aircraft,
  close,
  save,
  remove,
  canEdit,
}: {
  value: any;
  pilots: any[];
  aircraft: any[];
  close: () => void;
  save: (d: any) => void;
  remove?: () => void;
  canEdit: boolean;
}) {
  const kind = value?.kind === "maintenance" ? "maintenance" : "pilot";
  const start = value?.start_at?.slice(0, 10) || value?.date || localDate(),
    end = value?.end_at?.slice(0, 10) || value?.date || localDate();
  const [confirming, setConfirming] = useState(false);
  return (
    <ModalShell
      title={value?.id ? `Edit ${kind === "maintenance" ? "maintenance" : "pilot schedule"}` : kind === "maintenance" ? "Schedule aircraft maintenance" : "Schedule a pilot"}
      desc="Choose one day or a range of days. Aircraft conflicts are checked when you save."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          save({
            ...d,
            start_at: `${d.start_date}T00:00`,
            end_at: `${d.end_date}T23:59`,
            pilot_id: kind === "maintenance" ? null : d.pilot_id,
            kind,
            status: "Scheduled",
            start_date: undefined,
            end_date: undefined,
          });
        }}
      >
        <div className="form-grid">
          {kind === "pilot" && <Field label="PILOT">
            <select
              name="pilot_id"
              required
              defaultValue={value?.pilot_id || ""}
            >
              <option value="" disabled>
                Select pilot
              </option>
              {pilots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>}
          <Field label="AIRCRAFT">
            <select
              name="aircraft_id"
              required
              defaultValue={value?.aircraft_id || ""}
            >
              <option value="" disabled>
                Select aircraft
              </option>
              {aircraft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail} · {a.type}
                  {["Grounded", "Maintenance"].includes(a.status)
                    ? ` — ${a.status}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="DROP ZONE">
            <select name="dz" defaultValue={value?.dz || "Georgia"}>
              <option>Georgia</option>
              <option>Alabama</option>
              <option>Tennessee</option>
            </select>
          </Field>
          <span />
          <Field label="FIRST DAY">
            <input
              name="start_date"
              type="date"
              required
              defaultValue={start}
            />
          </Field>
          <Field label="LAST DAY">
            <input name="end_date" type="date" required defaultValue={end} />
          </Field>
          <Field label="NOTES" wide>
            <textarea
              name="notes"
              defaultValue={value?.notes || ""}
              placeholder="Optional assignment notes"
            />
          </Field>
        </div>
        <div className="modal-actions">
          {canEdit && remove &&
            (confirming ? (
              <>
                <span className="delete-confirm">
                  Remove this {kind === "maintenance" ? "maintenance booking" : "pilot from the schedule"}?
                </span>
                <button
                  type="button"
                  className="danger-action"
                  onClick={remove}
                >
                  Yes, remove
                </button>
              </>
            ) : (
              <button
                type="button"
                className="danger-link"
                onClick={() => setConfirming(true)}
              >
                Remove from schedule
              </button>
            ))}
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
          {canEdit && <button className="primary">
            {value?.id ? "Save changes" : kind === "maintenance" ? "Schedule maintenance" : "Schedule pilot"}
          </button>}
        </div>
      </form>
    </ModalShell>
  );
}
function EngineModal({
  value,
  aircraft,
  close,
  save,
  remove,
}: {
  value?: any;
  aircraft: any;
  close: () => void;
  save: (d: any) => void;
  remove?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <ModalShell
      title={value?.id ? "Edit engine configuration" : `Add engine · ${aircraft?.tail}`}
      desc="Baseline readings anchor all automatic engine and life-limited component calculations."
      close={close}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = Object.fromEntries(new FormData(event.currentTarget));
        save({
          aircraft_id: aircraft.id,
          position: String(form.position),
          model: String(form.model),
          serial_number: String(form.serial_number),
          baseline_ttsn: Number(form.baseline_ttsn),
          baseline_csn: Number(form.baseline_csn),
          baseline_ttsoh: Number(form.baseline_ttsoh),
          baseline_tcsoh: Number(form.baseline_tcsoh),
          baseline_starts: Number(form.baseline_starts || 0),
          baseline_flights: Number(form.baseline_flights || 0),
          cycle_basis: "actual_cycles",
          tracking_start_date: String(form.tracking_start_date),
          source_reference: String(form.source_reference || ""),
          status: "Active",
        });
      }}>
        <div className="form-grid">
          <Field label="ENGINE POSITION"><input name="position" required defaultValue={value?.position || (aircraft?.type === "Twin Otter" ? "Engine 1" : "Engine")} /></Field>
          <Field label="ENGINE MODEL"><input name="model" required defaultValue={value?.model || ""} placeholder="PT6A-34" /></Field>
          <Field label="ENGINE SERIAL NUMBER"><input name="serial_number" required defaultValue={value?.serial_number || ""} /></Field>
          <Field label="TRACKING START DATE"><input name="tracking_start_date" type="date" required defaultValue={value?.tracking_start_date || localDate()} /></Field>
          <Field label="TTSN AT BASELINE"><input name="baseline_ttsn" type="number" min="0" step=".1" required defaultValue={value?.baseline_ttsn ?? ""} /></Field>
          <Field label="CSN AT BASELINE"><input name="baseline_csn" type="number" min="0" step=".1" required defaultValue={value?.baseline_csn ?? ""} /></Field>
          <Field label="TTSOH AT BASELINE"><input name="baseline_ttsoh" type="number" min="0" step=".1" required defaultValue={value?.baseline_ttsoh ?? ""} /></Field>
          <Field label="TCSOH AT BASELINE"><input name="baseline_tcsoh" type="number" min="0" step=".1" required defaultValue={value?.baseline_tcsoh ?? ""} /></Field>
          <div className="both-note wide">
            <CircleGauge />
            <span><b>No historical start or flight count?</b><small>Leave these counters at 0. The app will begin counting new starts and flights from the tracking start date; do not estimate missing history.</small></span>
          </div>
          <Field label="START COUNT AT TRACKING START"><input name="baseline_starts" type="number" min="0" step="1" defaultValue={value?.baseline_starts ?? 0} /></Field>
          <Field label="FLIGHT COUNT AT TRACKING START"><input name="baseline_flights" type="number" min="0" step="1" defaultValue={value?.baseline_flights ?? 0} /></Field>
          <div className="both-note wide"><CircleGauge /><span><b>CSN and TCSOH use actual cycles</b><small>The separate Cycles Today value in Daily Operations updates these totals. Loads and engine starts remain separate for component-life calculations.</small></span></div>
          <Field label="BASELINE SOURCE / RECORD REFERENCE" wide><textarea name="source_reference" defaultValue={value?.source_reference || ""} placeholder="Logbook entry, work order, or approved record reference" /></Field>
        </div>
        <div className="modal-actions">
          {remove && (!confirmingDelete ? <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>Archive engine</button> : <><span className="delete-confirm">Archive this engine configuration?</span><button type="button" className="danger-action" onClick={remove}>Yes, archive</button></>)}
          <button type="button" className="ghost" onClick={close}>Cancel</button>
          <button className="primary">Save engine</button>
        </div>
      </form>
    </ModalShell>
  );
}

function EngineComponentModal({
  value,
  engine,
  close,
  save,
  remove,
  replacement = false,
}: {
  value?: any;
  engine: any;
  close: () => void;
  save: (d: any) => void;
  remove?: () => void;
  replacement?: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <ModalShell
      title={replacement ? `Replace ${value?.description}` : value?.id ? "Edit life-limited component" : `Add component · ${engine?.position}`}
      desc="Use only values and factors supported by current approved maintenance documentation."
      close={close}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        save({
          engine_id: engine.id,
          description: String(form.get("description")),
          part_number: String(form.get("part_number")),
          serial_number: String(form.get("serial_number")),
          max_cycles: Number(form.get("max_cycles")),
          baseline_component_cycles: Number(form.get("baseline_component_cycles")),
          baseline_engine_starts: replacement
            ? Number(engine?.total_starts || 0)
            : Number(value?.baseline_engine_starts ?? engine?.total_starts ?? 0),
          baseline_engine_flights: replacement
            ? Number(engine?.total_flights || 0)
            : Number(value?.baseline_engine_flights ?? engine?.total_flights ?? 0),
          acf: Number(form.get("acf")),
          fcf: Number(form.get("fcf")),
          warning_cycles: Number(form.get("warning_cycles")),
          source_reference: String(form.get("source_reference")),
          source_verified: form.get("source_verified") === "on",
          installation_date: String(form.get("installation_date")),
          maintenance_record: String(form.get("maintenance_record") || ""),
          ...(replacement ? {
            removed_at: String(form.get("removed_at")),
            removed_details: String(form.get("removed_details")),
          } : {}),
        });
      }}>
        <div className="form-grid">
          <div className="both-note wide">
            <CircleGauge />
            <span>
              <b>PT6A component-cycle calculation</b>
              <small>Accumulated cycles = [S + (F − S) ÷ ACF] × FCF. Current cycles = documented base cycles + accumulated cycles.</small>
            </span>
          </div>
          {replacement && <>
            <div className="both-note wide"><Wrench /><span><b>Removed component</b><small>{value?.part_number} · S/N {value?.serial_number} · {value?.current_cycles == null ? "cycles require review" : `${Number(value.current_cycles).toFixed(1)} calculated cycles`}</small></span></div>
            <Field label="REMOVAL DATE"><input name="removed_at" type="date" required defaultValue={localDate()} /></Field>
            <Field label="REMOVAL RECORD / DETAILS"><input name="removed_details" required placeholder="Work order and disposition" /></Field>
          </>}
          <Field label="COMPONENT DESCRIPTION"><input name="description" required defaultValue={value?.description || ""} placeholder="Compressor disk" /></Field>
          <Field label="PART NUMBER"><input name="part_number" required defaultValue={replacement ? "" : value?.part_number || ""} /></Field>
          <Field label="SERIAL NUMBER"><input name="serial_number" required defaultValue={replacement ? "" : value?.serial_number || ""} /></Field>
          <Field label="APPROVED MAXIMUM LIFE CYCLES"><input name="max_cycles" type="number" min="0.1" step=".1" required defaultValue={replacement ? "" : value?.max_cycles ?? ""} /></Field>
          <Field label="DOCUMENTED COMPONENT CYCLES AT BASELINE"><input name="baseline_component_cycles" type="number" min="0" step=".1" required defaultValue={replacement ? "" : value?.baseline_component_cycles ?? ""} /></Field>
          <div className="both-note wide"><CircleGauge /><span><b>Use the component's current accumulated cycles</b><small>Enter the documented component cycles shown by the old tracker on this baseline date. The app automatically snapshots the engine start and flight counters from this date forward.</small></span></div>
          <Field label="ABBREVIATED CYCLE FACTOR (ACF)"><input name="acf" type="number" min=".0001" step=".0001" required defaultValue={replacement ? "" : value?.acf ?? ""} /></Field>
          <Field label="FLIGHT COUNT FACTOR (FCF)"><input name="fcf" type="number" min=".0001" step=".0001" required defaultValue={replacement ? "" : value?.fcf ?? ""} /></Field>
          <Field label="ADVANCE WARNING — REMAINING CYCLES"><input name="warning_cycles" type="number" min="0" step="1" required defaultValue={replacement ? value?.warning_cycles ?? 250 : value?.warning_cycles ?? 250} /></Field>
          <Field label="INSTALLATION / TRACKING BASELINE DATE"><input name="installation_date" type="date" required defaultValue={replacement ? localDate() : value?.installation_date || localDate()} /></Field>
          <Field label="APPROVED MANUAL / SERVICE BULLETIN REFERENCE" wide><textarea name="source_reference" required defaultValue={replacement ? "" : value?.source_reference || ""} placeholder="Manual chapter/revision, service bulletin, or other approved source" /></Field>
          <Field label="SUPPORTING MAINTENANCE RECORD" wide><textarea name="maintenance_record" defaultValue={replacement ? "" : value?.maintenance_record || ""} placeholder="Work order, logbook entry, or document reference" /></Field>
          <label className="account-active wide"><input name="source_verified" type="checkbox" defaultChecked={!replacement && Boolean(value?.source_verified)} /><span><b>Source values verified</b><small>Confirm the life limit and factors were reconciled to current approved documentation.</small></span></label>
        </div>
        <div className="modal-actions">
          {remove && (!confirmingDelete ? <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>Archive component</button> : <button type="button" className="danger-action" onClick={remove}>Yes, archive</button>)}
          <button type="button" className="ghost" onClick={close}>Cancel</button>
          <button className="primary">{replacement ? "Archive old and install replacement" : "Save component"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function MaintenanceModal({
  value,
  aircraft,
  close,
  save,
  remove,
}: {
  value: any;
  aircraft: any;
  close: () => void;
  save: (d: any) => void;
  remove?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showSecondWarning, setShowSecondWarning] = useState(
    value?.warning2_hours != null || value?.warning2_days != null || value?.warning2_cycles != null,
  );
  return (
    <SimpleForm
      title={
        value?.id
          ? "View / edit maintenance item"
          : `Add maintenance · ${aircraft?.tail}`
      }
      close={close}
      destructiveAction={remove && (
        confirmingDelete ? (
          <>
            <span className="delete-confirm">Delete this maintenance item?</span>
            <button type="button" className="danger-action" onClick={remove}>Yes, delete</button>
            <button type="button" className="ghost" onClick={() => setConfirmingDelete(false)}>Keep item</button>
          </>
        ) : (
          <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>Delete maintenance item</button>
        )
      )}
      submit={(d) => {
        const optionalNumber = (input: unknown) =>
            input === "" || input == null ? null : Number(input),
          dueHours = optionalNumber(d.due_hours),
          component = ["engine", "engine1", "engine2"].includes(String(d.component))
            ? String(d.component)
            : "airframe",
          enginePrefix = component === "engine1" ? "engine1" : component === "engine2" ? "engine2" : "engine",
          timeBasis = ["hobbs", "ttsn", "engine_ttsn", "engine_ttsoh"].includes(String(d.due_time_basis))
            ? String(d.due_time_basis)
            : "ttsn",
          cycleBasis = ["tcsn", "engine_tcsn", "engine_tcsoh"].includes(String(d.due_cycle_basis))
            ? String(d.due_cycle_basis)
            : "tcsn",
          timeLabel = timeBasis === "hobbs" ? "Hobbs" : timeBasis === "engine_ttsn" ? "Engine TTSN" : timeBasis === "engine_ttsoh" ? "Engine TTSOH" : "TTSN",
          cycleLabel = cycleBasis === "engine_tcsn" ? "Engine TCSN" : cycleBasis === "engine_tcsoh" ? "Engine TCSOH" : "TCSN",
          dueCycles = optionalNumber(d.due_cycles),
          warningHours = optionalNumber(d.warning_hours),
          warningDays = optionalNumber(d.warning_days),
          warningCycles = optionalNumber(d.warning_cycles),
          warning2Hours = showSecondWarning ? optionalNumber(d.warning2_hours) : null,
          warning2Days = showSecondWarning ? optionalNumber(d.warning2_days) : null,
          warning2Cycles = showSecondWarning ? optionalNumber(d.warning2_cycles) : null,
          intervalHours = optionalNumber(d.interval_hours),
          intervalDays = optionalNumber(d.interval_days),
          intervalMonths = optionalNumber(d.interval_months),
          intervalCycles = optionalNumber(d.interval_cycles),
          dueDate = String(d.due_date || ""),
          trackedTime = timeBasis === "hobbs"
            ? Number(aircraft.hobbs ?? aircraft.time)
            : timeBasis === "engine_ttsn"
              ? Number(aircraft[`${enginePrefix}_ttsn`] ?? 0)
              : timeBasis === "engine_ttsoh"
                ? Number(aircraft[`${enginePrefix}_ttsoh`] ?? aircraft[`${enginePrefix}_tsmoh`] ?? 0)
                : Number(aircraft.ttsn ?? aircraft.time),
          trackedCycles = cycleBasis === "engine_tcsn"
            ? Number(aircraft[`${enginePrefix}_tcsn`] ?? 0)
            : cycleBasis === "engine_tcsoh"
              ? Number(aircraft[`${enginePrefix}_tcsoh`] ?? 0)
              : Number(aircraft.tcsn ?? aircraft.cycles),
          hoursLeft = dueHours == null ? null : dueHours - trackedTime,
          cyclesLeft = dueCycles == null ? null : dueCycles - trackedCycles,
          daysLeft = !dueDate ? null : Math.ceil(
            (new Date(`${dueDate}T23:59:59`).getTime() - Date.now()) / 86400000,
          ),
          overdue = (hoursLeft != null && hoursLeft <= 0) ||
            (daysLeft != null && daysLeft <= 0) ||
            (cyclesLeft != null && cyclesLeft <= 0),
          soon = (hoursLeft != null && warningHours != null && hoursLeft <= warningHours) ||
            (daysLeft != null && warningDays != null && daysLeft <= warningDays) ||
            (cyclesLeft != null && warningCycles != null && cyclesLeft <= warningCycles) ||
            (hoursLeft != null && warning2Hours != null && hoursLeft <= warning2Hours) ||
            (daysLeft != null && warning2Days != null && daysLeft <= warning2Days) ||
            (cyclesLeft != null && warning2Cycles != null && cyclesLeft <= warning2Cycles),
          dueParts = [
            dueHours == null ? null : `${dueHours.toFixed(1)} ${timeLabel}`,
            dueDate || null,
            dueCycles == null ? null : `${dueCycles} ${cycleLabel}`,
          ].filter(Boolean),
          remainingParts = [
            hoursLeft == null ? null : `${hoursLeft.toFixed(1)} hr ${timeLabel}`,
            daysLeft == null ? null : `${daysLeft} days`,
            cyclesLeft == null ? null : `${cyclesLeft} cycles ${cycleLabel}`,
          ].filter(Boolean),
          remainingValues = [hoursLeft, daysLeft, cyclesLeft].filter((x): x is number => x != null),
          warningValues = [warningHours, warningDays, warningCycles, warning2Hours, warning2Days, warning2Cycles].filter((x): x is number => x != null),
          dueKinds = [dueHours != null ? "hours" : null, dueDate ? "date" : null, dueCycles != null ? "cycles" : null].filter(Boolean);
        save({
          ...d,
          aircraft_id: aircraft.id,
          component,
          due_time_basis: timeBasis,
          due_cycle_basis: cycleBasis,
          due_hours: dueHours,
          due_date: dueDate || null,
          due_cycles: dueCycles,
          warning_hours: warningHours,
          warning_days: warningDays,
          warning_cycles: warningCycles,
          warning2_hours: warning2Hours,
          warning2_days: warning2Days,
          warning2_cycles: warning2Cycles,
          due_kind: dueKinds.join("+") || "none",
          due: dueParts.join(" or ") || "No due limit set",
          remaining: remainingValues.length ? Math.min(...remainingValues) : 0,
          warning: warningValues.length ? Math.min(...warningValues) : 0,
          remaining_label: remainingParts.join(" / ") || "No due limit set",
          interval_hours: intervalHours,
          interval_days: intervalDays,
          interval_months: intervalMonths,
          interval_cycles: intervalCycles,
          status: overdue ? "Overdue" : soon ? "Due soon" : dueParts.length ? "OK" : "Tracking",
        });
      }}
    >
      <Field label="ITEM">
        <input
          name="item"
          required
          defaultValue={value?.item || ""}
          placeholder="100 Hour Inspection"
        />
      </Field>
      <Field label="MAINTENANCE SECTION">
        <select name="component" defaultValue={value?.component || "airframe"}>
          <option value="airframe">Airframe</option>
          {aircraft?.type === "Twin Otter" ? <>
            <option value="engine1">Engine 1</option>
            <option value="engine2">Engine 2</option>
          </> : <option value="engine">Engine</option>}
        </select>
      </Field>
      <Field label="TIME BASIS">
        <select name="due_time_basis" defaultValue={value?.due_time_basis || "ttsn"}>
          <option value="ttsn">Airframe TTSN</option>
          <option value="hobbs">Airframe Hobbs</option>
          <option value="engine_ttsn">Engine TTSN</option>
          <option value="engine_ttsoh">Engine TTSOH</option>
        </select>
      </Field>
      <Field label="DUE AT SELECTED AIRCRAFT TIME">
        <input
          name="due_hours"
          type="number"
          min="0"
          step=".1"
          defaultValue={value?.due_hours || ""}
          placeholder="Enter the due time"
        />
      </Field>
      <Field label="DUE DATE">
        <input
          name="due_date"
          type="date"
          defaultValue={value?.due_date || ""}
        />
      </Field>
      <Field label="DUE AT AIRCRAFT CYCLES">
        <input
          name="due_cycles"
          type="number"
          min="0"
          step="1"
          defaultValue={value?.due_cycles ?? ""}
          placeholder="Optional TCSN limit"
        />
      </Field>
      <Field label="CYCLE BASIS">
        <select name="due_cycle_basis" defaultValue={value?.due_cycle_basis || "tcsn"}>
          <option value="tcsn">Airframe TCSN</option>
          <option value="engine_tcsn">Engine TCSN</option>
          <option value="engine_tcsoh">Engine TCSOH</option>
        </select>
      </Field>
      <Field label="WARNING — HOURS BEFORE">
        <input
          name="warning_hours"
          type="number"
          min="0"
          step=".1"
          defaultValue={value?.warning_hours ?? ""}
          placeholder="Optional"
        />
      </Field>
      <Field label="WARNING — DAYS BEFORE">
        <input
          name="warning_days"
          type="number"
          min="0"
          step="1"
          defaultValue={value?.warning_days ?? ""}
          placeholder="Optional"
        />
      </Field>
      <Field label="WARNING — CYCLES BEFORE">
        <input
          name="warning_cycles"
          type="number"
          min="0"
          step="1"
          defaultValue={value?.warning_cycles ?? ""}
          placeholder="Optional"
        />
      </Field>
      <div className="wide warning-toggle">
        <button type="button" className="ghost" onClick={() => setShowSecondWarning((shown) => !shown)}>
          {showSecondWarning ? "Remove second warning" : "+ Add a second warning"}
        </button>
      </div>
      {showSecondWarning && <>
        <Field label="SECOND WARNING — HOURS BEFORE"><input name="warning2_hours" type="number" min="0" step=".1" defaultValue={value?.warning2_hours ?? ""} placeholder="Optional" /></Field>
        <Field label="SECOND WARNING — DAYS BEFORE"><input name="warning2_days" type="number" min="0" step="1" defaultValue={value?.warning2_days ?? ""} placeholder="Optional" /></Field>
        <Field label="SECOND WARNING — CYCLES BEFORE"><input name="warning2_cycles" type="number" min="0" step="1" defaultValue={value?.warning2_cycles ?? ""} placeholder="Optional" /></Field>
      </>}
      <Field label="REPEAT EVERY — HOURS">
        <input
          name="interval_hours"
          type="number"
          min="0"
          step=".1"
          defaultValue={value?.interval_hours || ""}
          placeholder="Example: 100"
        />
      </Field>
      <Field label="REPEAT EVERY — DAYS">
        <input
          name="interval_days"
          type="number"
          min="0"
          step="1"
          defaultValue={value?.interval_days || ""}
          placeholder="Example: 365"
        />
      </Field>
      <Field label="REPEAT EVERY — CALENDAR MONTHS">
        <input
          name="interval_months"
          type="number"
          min="1"
          step="1"
          defaultValue={value?.interval_months ?? ""}
          placeholder="Example: 12"
        />
      </Field>
      <Field label="REPEAT EVERY — CYCLES">
        <input
          name="interval_cycles"
          type="number"
          min="0"
          step="1"
          defaultValue={value?.interval_cycles ?? ""}
          placeholder="Example: 500"
        />
      </Field>
      <div className="both-note">
        <Clock3 />
        <span>
          <b>Use only the fields you need</b>
          <small>
            Blank hours, dates, cycles, warnings, and repeat intervals are ignored.
          </small>
        </span>
      </div>
    </SimpleForm>
  );
}
