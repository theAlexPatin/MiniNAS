import { cors } from "hono/cors";
import { config } from "../config.js";

const origins = [config.rp.origin];
if (config.baseUrl && config.baseUrl !== config.rp.origin) {
  origins.push(config.baseUrl);
}

export const corsMiddleware = cors({
  origin: origins,
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Tus-Resumable", "Upload-Length", "Upload-Offset", "Upload-Metadata"],
  exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Tus-Resumable", "Upload-Offset", "Upload-Length", "Location"],
});
