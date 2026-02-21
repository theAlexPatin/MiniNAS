import fs from "node:fs";
import { getDb } from "../db/index.js";
import type { VolumeConfig } from "../config.js";

export function getVolumes(): VolumeConfig[] {
  const db = getDb();
  return db.prepare("SELECT id, label, path FROM volumes ORDER BY rowid").all() as VolumeConfig[];
}

export function getVolumeById(id: string): VolumeConfig | null {
  const db = getDb();
  return (db.prepare("SELECT id, label, path FROM volumes WHERE id = ?").get(id) as VolumeConfig) ?? null;
}

export function addVolume(id: string, label: string, path: string): void {
  if (!fs.existsSync(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }
  const db = getDb();
  db.prepare("INSERT INTO volumes (id, label, path) VALUES (?, ?, ?)").run(id, label, path);
}

export function removeVolume(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM volumes WHERE id = ?").run(id);
  return result.changes > 0;
}

export function migrateEnvVolumes(): void {
  const raw = process.env.VOLUMES;
  if (!raw) return;

  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM volumes").get() as { n: number }).n;
  if (count > 0) return;

  const entries = raw.split(",").map((entry) => {
    const [id, label, ...pathParts] = entry.trim().split(":");
    return { id, label, path: pathParts.join(":") };
  });

  const insert = db.prepare("INSERT INTO volumes (id, label, path) VALUES (?, ?, ?)");
  for (const v of entries) {
    insert.run(v.id, v.label, v.path);
  }

  console.log(`Migrated ${entries.length} volume(s) from VOLUMES env var to database.`);
  console.log("You can now remove the VOLUMES line from your .env file.");
}
