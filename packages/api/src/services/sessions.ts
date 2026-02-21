import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { getDb } from "../db/index.js";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.sessionSecret);
const SESSION_DURATION_HOURS = 24 * 7; // 7 days

export interface SessionPayload {
  sub: string; // user_id
  jti: string; // session id
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const jti = nanoid();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
  );

  db.prepare(
    "INSERT INTO sessions (jti, user_id, expires_at, last_active_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(jti, userId, expiresAt.toISOString());

  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(secret);

  return token;
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const { sub, jti } = payload as unknown as SessionPayload;

    if (!sub || !jti) return null;

    const db = getDb();
    const session = db
      .prepare(
        "SELECT * FROM sessions WHERE jti = ? AND user_id = ? AND expires_at > datetime('now')"
      )
      .get(jti, sub) as { jti: string } | undefined;

    if (!session) return null;

    // Update last active
    db.prepare(
      "UPDATE sessions SET last_active_at = datetime('now') WHERE jti = ?"
    ).run(jti);

    return { sub, jti };
  } catch {
    return null;
  }
}

export function revokeSession(jti: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE jti = ?").run(jti);
}

export function revokeAllUserSessions(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
