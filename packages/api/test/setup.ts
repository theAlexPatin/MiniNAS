import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

const testDir = join(tmpdir(), `mininas-test-${randomUUID()}`);

// Configure env vars BEFORE any app modules are imported
process.env.DB_PATH = ":memory:";
process.env.SESSION_SECRET = "test-secret-key-for-unit-tests-minimum-length";
process.env.CLI_SECRET = "test-cli-secret";
process.env.BASE_URL = "https://test.example.com";
process.env.RP_NAME = "MiniNAS Test";
process.env.PORT = "0";
process.env.PUBLIC_SHARE_PORT = "0";
process.env.THUMBNAIL_DIR = join(testDir, "thumbnails");
process.env.UPLOAD_STAGING_DIR = join(testDir, "uploads");
process.env.AUDIT_LOG_DIR = join(testDir, "audit");

// Create temp dirs so module-level initializers don't fail
mkdirSync(process.env.THUMBNAIL_DIR, { recursive: true });
mkdirSync(process.env.UPLOAD_STAGING_DIR, { recursive: true });
mkdirSync(process.env.AUDIT_LOG_DIR, { recursive: true });
