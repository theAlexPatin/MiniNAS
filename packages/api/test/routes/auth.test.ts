import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import {
  resetDb,
  createTestUser,
  createTestCredential,
  createTestSession,
} from "../helpers.js";

beforeEach(() => resetDb());

describe("GET /api/v1/auth/setup-needed", () => {
  it("returns setupNeeded: true when no users exist", async () => {
    const res = await app.request("/api/v1/auth/setup-needed");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.setupNeeded).toBe(true);
  });

  it("returns setupNeeded: false when user with credentials exists", async () => {
    createTestUser("u1", "admin", "admin");
    createTestCredential("cred1", "u1");
    const res = await app.request("/api/v1/auth/setup-needed");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.setupNeeded).toBe(false);
  });

  it("returns setupNeeded: true when user exists but no credentials", async () => {
    createTestUser("u1", "admin", "admin");
    // No credentials
    const res = await app.request("/api/v1/auth/setup-needed");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.setupNeeded).toBe(true);
  });
});

describe("GET /api/v1/auth/session", () => {
  it("returns unauthenticated when no session cookie", async () => {
    const res = await app.request("/api/v1/auth/session");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("returns authenticated with valid session", async () => {
    createTestUser("u1", "admin", "admin");
    const token = await createTestSession("u1");
    const res = await app.request("/api/v1/auth/session", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user).toMatchObject({
      id: "u1",
      username: "admin",
      role: "admin",
    });
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears session", async () => {
    createTestUser("u1", "admin", "admin");
    const token = await createTestSession("u1");
    const res = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);

    // Session should now be invalid
    const check = await app.request("/api/v1/auth/session", {
      headers: { Cookie: `session=${token}` },
    });
    const body = await check.json();
    expect(body.authenticated).toBe(false);
  });
});

describe("GET /api/v1/auth/registration/options", () => {
  it("returns 403 when users with credentials exist", async () => {
    createTestUser("u1", "admin", "admin");
    createTestCredential("cred1", "u1");
    const res = await app.request("/api/v1/auth/registration/options");
    expect(res.status).toBe(403);
  });

  it("returns registration options when no users exist", async () => {
    const res = await app.request("/api/v1/auth/registration/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBeDefined();
    expect(body.rp).toBeDefined();
  });
});

describe("GET /api/v1/auth/authentication/options", () => {
  it("returns 400 when no users exist", async () => {
    const res = await app.request("/api/v1/auth/authentication/options");
    expect(res.status).toBe(400);
  });

  it("returns options when credentials exist", async () => {
    createTestUser("u1", "admin", "admin");
    createTestCredential("cred1", "u1");
    const res = await app.request("/api/v1/auth/authentication/options");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBeDefined();
  });
});
