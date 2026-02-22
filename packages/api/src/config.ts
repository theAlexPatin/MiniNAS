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

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  sessionSecret: process.env.SESSION_SECRET || "change-me",
  rp: {
    id: process.env.RP_ID || "localhost",
    name: process.env.RP_NAME || "MiniNAS",
    origin: process.env.RP_ORIGIN || "http://localhost:4321",
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
