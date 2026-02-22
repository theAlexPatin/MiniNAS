import { getDb } from "../src/db/index.js";

/**
 * Delete all data from all tables. Call in beforeEach to isolate tests.
 * Order: children first to respect foreign key constraints.
 */
export function resetDb(): void {
  const db = getDb();
  db.exec("DELETE FROM webdav_tokens");
  db.exec("DELETE FROM volume_access");
  db.exec("DELETE FROM share_links");
  db.exec("DELETE FROM invite_tokens");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM challenges");
  db.exec("DELETE FROM credentials");
  db.exec("DELETE FROM file_index");
  db.exec("DELETE FROM volumes");
  db.exec("DELETE FROM users");
}

export function createTestUser(
  id: string,
  username: string,
  role: string = "user"
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO users (id, username, role) VALUES (?, ?, ?)"
  ).run(id, username, role);
}

export function createTestVolume(
  id: string,
  label: string,
  volumePath: string,
  visibility: string = "public"
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO volumes (id, label, path, visibility) VALUES (?, ?, ?, ?)"
  ).run(id, label, volumePath, visibility);
}

export function createTestCredential(id: string, userId: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO credentials (id, user_id, public_key, counter) VALUES (?, ?, X'00', 0)"
  ).run(id, userId);
}

export async function createTestSession(userId: string): Promise<string> {
  const { createSession } = await import("../src/services/sessions.js");
  return createSession(userId);
}
