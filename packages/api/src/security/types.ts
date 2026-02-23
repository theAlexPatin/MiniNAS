import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export interface Identity {
  /** User ID (real user for session/webdav, synthetic for CLI) */
  userId: string;
  /** How this identity was established */
  kind: "session" | "webdav" | "cli";
  /** Session JTI — only present for cookie-auth sessions */
  sessionId: string | null;
  /** User role */
  role: "admin" | "user";
}

const IDENTITY_KEY = "identity";

/**
 * Store an Identity on the request context.
 * Called by auth middleware — not by route handlers.
 */
export function setIdentity(c: Context, identity: Identity): void {
  c.set(IDENTITY_KEY as never, identity as never);
}

/**
 * Retrieve the Identity from the request context.
 * Throws 401 if no identity is present (use in routes behind auth).
 */
export function getIdentity(c: Context): Identity {
  const id = c.get(IDENTITY_KEY as never) as Identity | undefined;
  if (!id) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return id;
}

/**
 * Retrieve the Identity if present, or null.
 * Use in routes with optional auth (e.g. session check, logout).
 */
export function getOptionalIdentity(c: Context): Identity | null {
  return (c.get(IDENTITY_KEY as never) as Identity | undefined) ?? null;
}
