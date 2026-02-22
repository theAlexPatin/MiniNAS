import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load config: .env overrides ~/.mininas/config.json, real env vars override both.
// dotenv won't override existing env vars, so we load .env first (higher priority),
// then backfill from config.json (lower priority).
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const globalConfigPath = path.join(os.homedir(), ".mininas", "config.json");
if (fs.existsSync(globalConfigPath)) {
  try {
    const json = JSON.parse(fs.readFileSync(globalConfigPath, "utf-8"));
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string" && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {}
}

const dataDir = path.join(os.homedir(), ".mininas", "data");

export interface VolumeConfig {
  id: string;
  label: string;
  path: string;
}

const baseUrl = process.env.BASE_URL || "";

function normalizeBasePath(raw: string): string {
  if (!raw) return "";
  let p = raw.trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/+$/, "");
}

// Auto-derive RP settings from BASE_URL when not explicitly set
function deriveRpId(): string {
  if (process.env.RP_ID) return process.env.RP_ID;
  if (baseUrl) {
    try {
      return new URL(baseUrl).hostname;
    } catch { /* invalid URL, fall through */ }
  }
  return "localhost";
}

function deriveRpOrigin(): string {
  if (process.env.RP_ORIGIN) return process.env.RP_ORIGIN;
  if (baseUrl) return baseUrl;
  return "http://localhost:4321";
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  baseUrl,
  publicSharePort: parseInt(process.env.PUBLIC_SHARE_PORT || "0", 10),
  publicShareUrl: process.env.PUBLIC_SHARE_URL || "",
  rp: {
    id: deriveRpId(),
    name: process.env.RP_NAME || "MiniNAS",
    origin: deriveRpOrigin(),
  },
  dbPath: process.env.DB_PATH || path.join(dataDir, "mininas.db"),
  thumbnailDir:
    process.env.THUMBNAIL_DIR || path.join(dataDir, "thumbnails"),
  uploadStagingDir:
    process.env.UPLOAD_STAGING_DIR || path.join(dataDir, "uploads"),
  cliSecret: process.env.CLI_SECRET || "",
  auditLogDir:
    process.env.AUDIT_LOG_DIR ||
    path.join(os.homedir(), ".mininas", "logs", "audit"),
  webDistDir: process.env.WEB_DIST_DIR || "",
  basePath: normalizeBasePath(process.env.BASE_PATH || ""),
  version: process.env.MININAS_VERSION || "dev",
} as const;
