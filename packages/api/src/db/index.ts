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
  }
  return db;
}
