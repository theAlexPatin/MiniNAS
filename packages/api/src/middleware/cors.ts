import { cors } from "hono/cors";
import { config } from "../config.js";

export const corsMiddleware = cors({
  origin: config.rp.origin,
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Tus-Resumable", "Upload-Length", "Upload-Offset", "Upload-Metadata"],
  exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Tus-Resumable", "Upload-Offset", "Upload-Length", "Location"],
});
