import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { getDb } from "../db/index.js";
import { config } from "../config.js";
import { createSession, revokeSession } from "../services/sessions.js";
import { validateInvite, markInviteUsed } from "../services/invites.js";

const auth = new Hono();

const rpID = config.rp.id;
const rpName = config.rp.name;
const origin = config.rp.origin;

interface DbCredential {
  id: string;
  user_id: string;
  public_key: Buffer;
  counter: number;
  device_type: string | null;
  transports: string | null;
}

interface DbChallenge {
  id: string;
  challenge: string;
  user_id: string | null;
  type: string;
  expires_at: string;
}

function hasUsersWithCredentials(): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM users u WHERE EXISTS (SELECT 1 FROM credentials c WHERE c.user_id = u.id)"
  ).get() as { count: number };
  return row.count > 0;
}

// Registration options — only available if no users exist (setup) or authenticated
auth.get("/registration/options", async (c) => {
  const db = getDb();
  const setupMode = !hasUsersWithCredentials();

  // For now, only allow registration during setup (no users with credentials)
  if (!setupMode) {
    return c.json({ error: "Registration not available" }, 403);
  }

  // Reuse existing admin user if one exists (e.g. after passkey reset)
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  const userId = existingAdmin?.id || nanoid();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "admin",
    userDisplayName: "Admin",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge
  const challengeId = nanoid();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  db.prepare(
    "INSERT INTO challenges (id, challenge, user_id, type, expires_at) VALUES (?, ?, ?, 'registration', ?)"
  ).run(challengeId, options.challenge, userId, expiresAt.toISOString());

  setCookie(c, "challenge_id", challengeId, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  // Also store the pending userId
  setCookie(c, "pending_user_id", userId, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  return c.json(options);
});

// Verify registration
auth.post("/registration/verify", async (c) => {
  if (hasUsersWithCredentials()) {
    return c.json({ error: "Registration not available" }, 403);
  }

  const db = getDb();
  const body = await c.req.json();
  const challengeId = getCookie(c, "challenge_id");
  const pendingUserId = getCookie(c, "pending_user_id");

  if (!challengeId || !pendingUserId) {
    return c.json({ error: "No pending challenge" }, 400);
  }

  const challenge = db
    .prepare(
      "SELECT * FROM challenges WHERE id = ? AND type = 'registration' AND expires_at > datetime('now')"
    )
    .get(challengeId) as DbChallenge | undefined;

  if (!challenge) {
    return c.json({ error: "Challenge expired or not found" }, 400);
  }

  // Clean up challenge
  db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);
  deleteCookie(c, "challenge_id", { path: "/" });
  deleteCookie(c, "pending_user_id", { path: "/" });

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: "Verification failed" }, 400);
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Create admin user if they don't already exist (may exist after passkey reset)
    db.prepare(
      "INSERT OR IGNORE INTO users (id, username, role) VALUES (?, ?, 'admin')"
    ).run(pendingUserId, "admin");

    // Store credential
    db.prepare(
      "INSERT INTO credentials (id, user_id, public_key, counter, device_type, transports) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      credential.id,
      pendingUserId,
      Buffer.from(credential.publicKey),
      credential.counter,
      credentialDeviceType,
      JSON.stringify(credential.transports || [])
    );

    // Create session
    const token = await createSession(pendingUserId);

    setCookie(c, "session", token, {
      httpOnly: true,
      secure: rpID !== "localhost",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return c.json({ verified: true });
  } catch (err) {
    console.error("Registration error:", err);
    return c.json({ error: "Registration failed" }, 400);
  }
});

// Invite registration options — validate invite and generate WebAuthn registration challenge
auth.get("/invite/:token/options", async (c) => {
  const db = getDb();
  const token = c.req.param("token");

  const result = validateInvite(token);
  if (!result.valid || !result.invite) {
    return c.json({ error: result.error }, 400);
  }

  const userId = nanoid();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: result.invite.username,
    userDisplayName: result.invite.username,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const challengeId = nanoid();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  db.prepare(
    "INSERT INTO challenges (id, challenge, user_id, type, expires_at) VALUES (?, ?, ?, 'registration', ?)"
  ).run(challengeId, options.challenge, userId, expiresAt.toISOString());

  setCookie(c, "challenge_id", challengeId, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  setCookie(c, "pending_user_id", userId, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  setCookie(c, "invite_token", token, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  return c.json(options);
});

// Verify invite registration — create user with role='user'
auth.post("/invite/verify", async (c) => {
  const db = getDb();
  const body = await c.req.json();
  const challengeId = getCookie(c, "challenge_id");
  const pendingUserId = getCookie(c, "pending_user_id");
  const inviteToken = getCookie(c, "invite_token");

  if (!challengeId || !pendingUserId || !inviteToken) {
    return c.json({ error: "No pending challenge" }, 400);
  }

  const inviteResult = validateInvite(inviteToken);
  if (!inviteResult.valid || !inviteResult.invite) {
    return c.json({ error: inviteResult.error }, 400);
  }

  const challenge = db
    .prepare(
      "SELECT * FROM challenges WHERE id = ? AND type = 'registration' AND expires_at > datetime('now')"
    )
    .get(challengeId) as DbChallenge | undefined;

  if (!challenge) {
    return c.json({ error: "Challenge expired or not found" }, 400);
  }

  db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);
  deleteCookie(c, "challenge_id", { path: "/" });
  deleteCookie(c, "pending_user_id", { path: "/" });
  deleteCookie(c, "invite_token", { path: "/" });

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: "Verification failed" }, 400);
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Create user with role='user'
    db.prepare(
      "INSERT INTO users (id, username, role) VALUES (?, ?, 'user')"
    ).run(pendingUserId, inviteResult.invite.username);

    // Store credential
    db.prepare(
      "INSERT INTO credentials (id, user_id, public_key, counter, device_type, transports) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      credential.id,
      pendingUserId,
      Buffer.from(credential.publicKey),
      credential.counter,
      credentialDeviceType,
      JSON.stringify(credential.transports || [])
    );

    // Mark invite as used
    markInviteUsed(inviteToken, pendingUserId);

    // Create session
    const token = await createSession(pendingUserId);

    setCookie(c, "session", token, {
      httpOnly: true,
      secure: rpID !== "localhost",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return c.json({ verified: true });
  } catch (err) {
    console.error("Invite registration error:", err);
    return c.json({ error: "Registration failed" }, 400);
  }
});

// Authentication options
auth.get("/authentication/options", async (c) => {
  const db = getDb();

  if (!hasUsersWithCredentials()) {
    return c.json({ error: "No users registered, go to /setup" }, 400);
  }

  const credentials = db
    .prepare("SELECT id, transports FROM credentials")
    .all() as Pick<DbCredential, "id" | "transports">[];

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    userVerification: "preferred",
  });

  const challengeId = nanoid();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  db.prepare(
    "INSERT INTO challenges (id, challenge, type, expires_at) VALUES (?, ?, 'authentication', ?)"
  ).run(challengeId, options.challenge, expiresAt.toISOString());

  setCookie(c, "challenge_id", challengeId, {
    httpOnly: true,
    secure: rpID !== "localhost",
    sameSite: "Strict",
    maxAge: 300,
    path: "/",
  });

  return c.json(options);
});

// Verify authentication
auth.post("/authentication/verify", async (c) => {
  const db = getDb();
  const body = await c.req.json();
  const challengeId = getCookie(c, "challenge_id");

  if (!challengeId) {
    return c.json({ error: "No pending challenge" }, 400);
  }

  const challenge = db
    .prepare(
      "SELECT * FROM challenges WHERE id = ? AND type = 'authentication' AND expires_at > datetime('now')"
    )
    .get(challengeId) as DbChallenge | undefined;

  if (!challenge) {
    return c.json({ error: "Challenge expired or not found" }, 400);
  }

  db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);
  deleteCookie(c, "challenge_id", { path: "/" });

  const credentialId = body.id;
  const credential = db
    .prepare("SELECT * FROM credentials WHERE id = ?")
    .get(credentialId) as DbCredential | undefined;

  if (!credential) {
    return c.json({ error: "Credential not found" }, 400);
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(credential.public_key),
        counter: credential.counter,
        transports: credential.transports
          ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });

    if (!verification.verified) {
      return c.json({ error: "Verification failed" }, 400);
    }

    // Update counter
    db.prepare("UPDATE credentials SET counter = ? WHERE id = ?").run(
      verification.authenticationInfo.newCounter,
      credentialId
    );

    // Create session
    const token = await createSession(credential.user_id);

    setCookie(c, "session", token, {
      httpOnly: true,
      secure: rpID !== "localhost",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return c.json({ verified: true });
  } catch (err) {
    console.error("Authentication error:", err);
    return c.json({ error: "Authentication failed" }, 400);
  }
});

// Session check
auth.get("/session", async (c) => {
  const session = c.get("session" as never) as
    | { sub: string; jti: string }
    | undefined;
  if (!session) {
    return c.json({ authenticated: false });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(session.sub) as
    | { id: string; username: string; role: string }
    | undefined;

  return c.json({
    authenticated: true,
    user: user ? { id: user.id, username: user.username, role: user.role } : null,
  });
});

// Logout
auth.post("/logout", async (c) => {
  const session = c.get("session" as never) as
    | { sub: string; jti: string }
    | undefined;
  if (session) {
    revokeSession(session.jti);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});

// Setup check - is first-time setup needed?
auth.get("/setup-needed", (c) => {
  return c.json({ setupNeeded: !hasUsersWithCredentials() });
});

export default auth;
