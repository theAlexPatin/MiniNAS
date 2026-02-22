import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/auth.js";
import { adminMiddleware } from "./middleware/admin.js";
import { authRateLimit } from "./middleware/rate-limit.js";
import authRoutes from "./routes/auth.js";
import filesRoutes from "./routes/files.js";
import downloadRoutes from "./routes/download.js";
import volumesRoutes from "./routes/volumes.js";
import uploadRoutes, { cleanupStagingDir } from "./routes/upload.js";
import { cleanupOldLogs } from "./services/audit-log.js";
import searchRoutes from "./routes/search.js";
import previewRoutes from "./routes/preview.js";
import shareRoutes from "./routes/share.js";
import adminRoutes from "./routes/admin.js";
import cliRoutes from "./routes/cli.js";
import { cliAuthMiddleware } from "./middleware/cli-auth.js";
import { webdavAuthMiddleware } from "./middleware/webdav-auth.js";
import webdavRoutes from "./routes/webdav.js";
import webdavTokenRoutes from "./routes/webdav-tokens.js";

import { config } from "./config.js";

const app = config.basePath
  ? new Hono().basePath(config.basePath)
  : new Hono();

// Global middleware
app.use("*", logger());
app.use("/api/*", corsMiddleware);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Auth routes — rate-limited, some require no auth
const authApi = new Hono();
authApi.use("*", authRateLimit);
authApi.use("/session", optionalAuthMiddleware);
authApi.use("/logout", optionalAuthMiddleware);
authApi.route("/", authRoutes);
app.route("/api/v1/auth", authApi);

// Public share endpoints (no auth required)
// These must be registered BEFORE the protected routes
app.route("/api/v1/share", shareRoutes);

// Protected API routes
// Mount each sub-router directly on app with its own auth wrapper.
// Hono's /* wildcard doesn't work through double-nested .route() calls,
// so we use the same pattern as WebDAV: wrapper.use("*", auth) + wrapper.route("/", routes).
function withAuth(routes: Hono): Hono {
  const h = new Hono();
  h.use("*", authMiddleware);
  h.route("/", routes);
  return h;
}

app.route("/api/v1/files", withAuth(filesRoutes));
app.route("/api/v1/download", withAuth(downloadRoutes));
app.route("/api/v1/volumes", withAuth(volumesRoutes));
app.route("/api/v1/upload", withAuth(uploadRoutes));
app.route("/api/v1/search", withAuth(searchRoutes));
app.route("/api/v1/preview", withAuth(previewRoutes));
app.route("/api/v1/webdav-tokens", withAuth(webdavTokenRoutes));

// Admin routes (auth + admin required)
const adminApi = new Hono();
adminApi.use("*", authMiddleware);
adminApi.use("*", adminMiddleware);
adminApi.route("/", adminRoutes);
app.route("/api/v1/admin", adminApi);

// CLI routes (CLI_SECRET token required)
const cliApi = new Hono();
cliApi.use("*", cliAuthMiddleware);
cliApi.route("/", cliRoutes);
app.route("/api/v1/cli", cliApi);

// WebDAV (Basic Auth with app tokens)
const dav = new Hono();
dav.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.body(err.message, err.status);
  }
  console.error("WebDAV error:", err);
  return c.body("Internal Server Error", 500);
});
dav.use("*", async (c, next) => {
  // Ensure every WebDAV response advertises DAV support
  c.header("DAV", "1, 2");
  c.header("MS-Author-Via", "DAV");
  await next();
});
dav.use("*", webdavAuthMiddleware);
dav.route("/", webdavRoutes);
app.route("/dav", dav);

// Hourly cleanup of abandoned uploads
setInterval(cleanupStagingDir, 60 * 60 * 1000);

// Audit log: delete files older than 90 days on startup + daily
cleanupOldLogs();
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

// Static file serving (production single-process mode)
import { createStaticMiddleware } from "./middleware/static.js";

if (config.webDistDir) {
  app.use("*", createStaticMiddleware(config.webDistDir));
}

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export { app };
