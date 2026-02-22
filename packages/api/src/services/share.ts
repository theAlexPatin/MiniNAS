import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";

export interface ShareLink {
  id: string;
  user_id: string;
  volume: string;
  path: string;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  is_public: number;
  expires_at: string | null;
  created_at: string;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function createShareLink(opts: {
  userId: string;
  volume: string;
  path: string;
  password?: string;
  maxDownloads?: number;
  expiresInHours?: number;
  isPublic?: boolean;
}): ShareLink {
  const db = getDb();
  const id = nanoid(12);
  const passwordHash = opts.password ? hashPassword(opts.password) : null;
  const expiresAt = opts.expiresInHours
    ? new Date(Date.now() + opts.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  db.prepare(
    `INSERT INTO share_links (id, user_id, volume, path, password_hash, max_downloads, is_public, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, opts.userId, opts.volume, opts.path, passwordHash, opts.maxDownloads || null, opts.isPublic ? 1 : 0, expiresAt);

  return db.prepare("SELECT * FROM share_links WHERE id = ?").get(id) as ShareLink;
}

export function getShareLink(id: string): ShareLink | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM share_links WHERE id = ?").get(id) as ShareLink) || null;
}

export function validateShareLink(
  link: ShareLink,
  password?: string
): { valid: boolean; error?: string } {
  // Check expiration
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { valid: false, error: "Share link has expired" };
  }

  // Check download limit
  if (link.max_downloads && link.download_count >= link.max_downloads) {
    return { valid: false, error: "Download limit reached" };
  }

  // Check password
  if (link.password_hash) {
    if (!password) {
      return { valid: false, error: "Password required" };
    }
    if (hashPassword(password) !== link.password_hash) {
      return { valid: false, error: "Incorrect password" };
    }
  }

  return { valid: true };
}

export function incrementDownloadCount(id: string): void {
  const db = getDb();
  db.prepare("UPDATE share_links SET download_count = download_count + 1 WHERE id = ?").run(id);
}

export function listUserShares(userId: string): ShareLink[] {
  const db = getDb();
  return db.prepare("SELECT * FROM share_links WHERE user_id = ? ORDER BY created_at DESC").all(userId) as ShareLink[];
}

export function deleteShareLink(id: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM share_links WHERE id = ? AND user_id = ?").run(id, userId);
  return result.changes > 0;
}
