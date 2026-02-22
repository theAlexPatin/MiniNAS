import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.dbPath);
    fs.mkdirSync(dbDir, { recursive: true });

    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Run migrations
    const schemaPath = new URL("schema.sql", import.meta.url).pathname;
    const schema = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schema);

    // Column migrations — SQLite doesn't support ADD COLUMN IF NOT EXISTS
    try {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    } catch {
      // Column already exists
    }
    try {
      db.exec("ALTER TABLE volumes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
    } catch {
      // Column already exists
    }
    try {
      db.exec("ALTER TABLE share_links ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
    } catch {
      // Column already exists
    }

    // Ensure existing admin user has the admin role
    db.exec("UPDATE users SET role = 'admin' WHERE username = 'admin' AND role = 'user'");
  }
  return db;
}
