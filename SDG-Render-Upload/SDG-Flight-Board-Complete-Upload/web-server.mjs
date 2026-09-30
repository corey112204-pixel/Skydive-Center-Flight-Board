import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { db, handler as apiHandler } from "./server.mjs";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function webHandler(req, res) {
  const pathname = new URL(req.url, "http://local").pathname;
  if (pathname === "/api" || pathname.startsWith("/api/"))
    return apiHandler(req, res);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (pathname === "/health") {
    try {
      db.prepare("select 1").get();
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("ok");
    } catch {
      res.writeHead(503);
      return res.end("unhealthy");
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let path;
  try {
    path = resolve(dist, "." + decodeURIComponent(pathname));
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (path !== dist && !path.startsWith(dist + sep)) {
    res.writeHead(404);
    return res.end();
  }
  const file =
    pathname === "/" || !extname(pathname) ? resolve(dist, "index.html") : path;
  try {
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
      "Cache-Control": file.includes(`${sep}assets${sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : 500);
    res.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("PORT must be a valid TCP port");
  const server = createServer((req, res) => {
    void webHandler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.listen(port, "0.0.0.0", () =>
    console.info(`SDG Flight Operations listening on port ${port}`),
  );
  const shutdown = () => server.close(() => db.close());
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
