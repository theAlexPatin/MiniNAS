import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/auth.js";
import { authRateLimit } from "./middleware/rate-limit.js";
import authRoutes from "./routes/auth.js";
import filesRoutes from "./routes/files.js";
import downloadRoutes from "./routes/download.js";
import volumesRoutes from "./routes/volumes.js";
import uploadRoutes, { cleanupStagingDir } from "./routes/upload.js";
import searchRoutes from "./routes/search.js";
import previewRoutes from "./routes/preview.js";
import shareRoutes from "./routes/share.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("/api/*", corsMiddleware);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Auth routes — rate-limited, some require no auth
const authApi = new Hono();
authApi.use("*", authRateLimit);
authApi.use("/session", optionalAuthMiddleware);
authApi.route("/", authRoutes);
app.route("/api/v1/auth", authApi);

// Public share endpoints (no auth required)
// These must be registered BEFORE the protected routes
app.route("/api/v1/share", shareRoutes);

// Protected API routes
const api = new Hono();
api.use("*", authMiddleware);
api.route("/files", filesRoutes);
api.route("/download", downloadRoutes);
api.route("/volumes", volumesRoutes);
api.route("/upload", uploadRoutes);
api.route("/search", searchRoutes);
api.route("/preview", previewRoutes);

app.route("/api/v1", api);

// Hourly cleanup of abandoned uploads
setInterval(cleanupStagingDir, 60 * 60 * 1000);

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export { app };
