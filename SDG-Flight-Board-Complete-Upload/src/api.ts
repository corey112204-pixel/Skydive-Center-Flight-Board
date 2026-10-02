export type State = Record<string, any[]>;
async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("sdg_session");
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (res.status === 401 && path !== "/auth/login")
    localStorage.removeItem("sdg_session");
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const api = {
  login: async (email: string, password: string) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("sdg_session", data.token);
    return data.user;
  },
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("sdg_session");
    }
  },
  state: () => request("/state"),
  create: (r: string, d: any) =>
    request("/" + r, { method: "POST", body: JSON.stringify(d) }),
  update: (r: string, id: string, d: any) =>
    request(`/${r}/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  archive: (r: string, id: string) =>
    request(`/${r}/${id}`, { method: "DELETE" }),
  createSquawk: (d: any) =>
    request("/squawks", {
      method: "POST",
      body: JSON.stringify(d),
    }),
  updateSquawk: (id: string, d: any) =>
    request(`/squawks/${id}`, {
      method: "PUT",
      body: JSON.stringify(d),
    }),
  submitFlight: (d: any) =>
    request("/flight_records", {
      method: "POST",
      body: JSON.stringify(d),
    }),
  updateFlight: (id: string, d: any) =>
    request(`/flight_records/${id}`, {
      method: "PUT",
      body: JSON.stringify(d),
    }),
  replaceEngineComponent: (id: string, d: any) =>
    request(`/engine_components/${id}/replace`, {
      method: "POST",
      body: JSON.stringify(d),
    }),
  createTimeOff: (d: any) =>
    request("/timeoff", {
      method: "POST",
      body: JSON.stringify(d),
    }),
  uploadDocument: (d: any) =>
    request("/documents", {
      method: "POST",
      body: JSON.stringify(d),
    }),
  decideTimeOff: (id: string, status: string) =>
    request(`/timeoff/${id}`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  createUser: (d: any) =>
    request("/users", { method: "POST", body: JSON.stringify(d) }),
  updateUser: (id: string, d: any) =>
    request(`/users/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  readNotification: (id: string) =>
    request(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () =>
    request("/notifications/read-all", { method: "POST" }),
};
