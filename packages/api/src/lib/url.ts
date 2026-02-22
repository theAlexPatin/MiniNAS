import type { Context } from "hono";
import { config } from "../config.js";

export function getBaseUrl(c: Context): string {
  const host = c.req.header("Host");
  if (host) {
    const proto = c.req.header("X-Forwarded-Proto") || "https";
    return `${proto}://${host}${config.basePath}`;
  }
  return config.baseUrl
    ? `${config.baseUrl}${config.basePath}`
    : `http://localhost:${config.port}${config.basePath}`;
}
