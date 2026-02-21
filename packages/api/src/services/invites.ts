import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";

export interface InviteToken {
  id: string;
  created_by: string;
  username: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export function createInvite(
  createdBy: string,
  username: string,
  expiresInHours = 72
): InviteToken {
  const db = getDb();
  const id = nanoid();
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    "INSERT INTO invite_tokens (id, created_by, username, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, createdBy, username, expiresAt);

  return db
    .prepare("SELECT * FROM invite_tokens WHERE id = ?")
    .get(id) as InviteToken;
}

export function validateInvite(
  id: string
): { valid: boolean; error?: string; invite?: InviteToken } {
  const db = getDb();
  const invite = db
    .prepare("SELECT * FROM invite_tokens WHERE id = ?")
    .get(id) as InviteToken | undefined;

  if (!invite) {
    return { valid: false, error: "Invite not found" };
  }

  if (invite.used_by) {
    return { valid: false, error: "Invite already used" };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { valid: false, error: "Invite expired" };
  }

  return { valid: true, invite };
}

export function markInviteUsed(id: string, userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE invite_tokens SET used_by = ?, used_at = datetime('now') WHERE id = ?"
  ).run(userId, id);
}

export function listInvites(): InviteToken[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM invite_tokens ORDER BY created_at DESC")
    .all() as InviteToken[];
}

export function deleteInvite(id: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM invite_tokens WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
