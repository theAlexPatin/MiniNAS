import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

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
  dbPath: process.env.DB_PATH || "./data/mininas.db",
  thumbnailDir: process.env.THUMBNAIL_DIR || "./.mininas/thumbnails",
  uploadStagingDir:
    process.env.UPLOAD_STAGING_DIR || "./.mininas/uploads",
  cliSecret: process.env.CLI_SECRET || "",
} as const;
