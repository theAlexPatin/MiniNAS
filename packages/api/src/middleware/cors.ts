import { cors } from "hono/cors";
import { config } from "../config.js";

export const corsMiddleware = cors({
  origin: (origin, c) => {
    // Allow configured RP origin and BASE_URL
    if (origin === config.rp.origin) return origin;
    if (config.baseUrl && origin === config.baseUrl) return origin;

    // Derive allowed origin from Host header for dynamic access
    const host = c.req.header("Host");
    if (host) {
      const proto = c.req.header("X-Forwarded-Proto") || "https";
      const derived = `${proto}://${host}`;
      if (origin === derived) return origin;
    }

    return null;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Tus-Resumable", "Upload-Length", "Upload-Offset", "Upload-Metadata"],
  exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Tus-Resumable", "Upload-Offset", "Upload-Length", "Location"],
});
