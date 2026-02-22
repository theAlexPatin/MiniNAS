import dotenv from "dotenv";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const dataDir = path.join(os.homedir(), ".mininas", "data");

export interface VolumeConfig {
  id: string;
  label: string;
  path: string;
}

const baseUrl = process.env.BASE_URL || "";

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
} as const;
