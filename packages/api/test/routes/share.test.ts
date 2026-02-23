import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { publicShareApp } from "../../src/public-share-server.js";
import {
  resetDb,
  createTestUser,
  createTestVolume,
  createTestSession,
} from "../helpers.js";
import { createShareLink } from "../../src/services/share.js";

const API = "/api/v1/share";

const testDir = join(tmpdir(), `mininas-share-test-${randomUUID()}`);
const testFile = "hello.txt";
const testFileContent = "Hello, world!";

beforeEach(() => {
  resetDb();
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, testFile), testFileContent);
});

function authHeaders(token: string) {
  return { Cookie: `session=${token}` };
}

function jsonHeaders(token: string) {
  return { ...authHeaders(token), "Content-Type": "application/json" };
}

// Helper: create user, volume, and session
async function setup() {
  createTestUser("u1", "alice", "user");
  createTestVolume("v1", "Test Vol", testDir);
  const token = await createTestSession("u1");
  return token;
}

// ---------------------------------------------------------------------------
// Public endpoints (no auth required)
// ---------------------------------------------------------------------------

describe("GET /api/v1/share/:id/info", () => {
  it("returns share metadata without auth", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
    });

    const res = await app.request(`${API}/${link.id}/info`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(link.id);
    expect(body.filename).toBe(testFile);
    expect(body.hasPassword).toBe(false);
    expect(body.expiresAt).toBeNull();
  });

  it("indicates password-protected shares", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      password: "secret",
    });

    const res = await app.request(`${API}/${link.id}/info`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasPassword).toBe(true);
  });

  it("returns 404 for non-existent share", async () => {
    const res = await app.request(`${API}/nonexistent/info`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/share/:id/download", () => {
  it("downloads a shared file without auth", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
    });

    const res = await app.request(`${API}/${link.id}/download`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain(testFile);
    const text = await res.text();
    expect(text).toBe(testFileContent);
  });

  it("returns 404 for non-existent share", async () => {
    const res = await app.request(`${API}/nonexistent/download`);
    expect(res.status).toBe(404);
  });

  it("requires password when set", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      password: "secret",
    });

    const res = await app.request(`${API}/${link.id}/download`);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("rejects wrong password", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      password: "secret",
    });

    const res = await app.request(
      `${API}/${link.id}/download?password=wrong`
    );
    expect(res.status).toBe(403);
  });

  it("downloads with correct password", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      password: "secret",
    });

    const res = await app.request(
      `${API}/${link.id}/download?password=secret`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(testFileContent);
  });

  it("rejects expired share", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);

    // Insert an already-expired link directly
    const { getDb } = await import("../../src/db/index.js");
    const db = getDb();
    const past = new Date(Date.now() - 60_000).toISOString();
    db.prepare(
      `INSERT INTO share_links (id, user_id, volume, path, expires_at)
       VALUES ('expired1', 'u1', 'v1', ?, ?)`
    ).run(testFile, past);

    const res = await app.request(`${API}/expired1/download`);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("expired");
  });

  it("rejects when download limit reached", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      maxDownloads: 1,
    });

    // First download succeeds
    const res1 = await app.request(`${API}/${link.id}/download`);
    expect(res1.status).toBe(200);
    await res1.text(); // consume body

    // Second download is rejected
    const res2 = await app.request(`${API}/${link.id}/download`);
    expect(res2.status).toBe(403);
    const body = await res2.json();
    expect(body.error).toContain("limit");
  });

  it("increments download count on success", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
    });

    const res = await app.request(`${API}/${link.id}/download`);
    expect(res.status).toBe(200);
    await res.text();

    // Check via info endpoint
    const { getShareLink } = await import("../../src/services/share.js");
    const updated = getShareLink(link.id);
    expect(updated!.download_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Auth-protected endpoints
// ---------------------------------------------------------------------------

describe("POST /api/v1/share (create)", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: "v1", path: testFile }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a share link", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ volume: "v1", path: testFile }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share).toBeDefined();
    expect(body.share.volume).toBe("v1");
    expect(body.share.path).toBe(testFile);
    expect(body.url).toBeDefined();
  });

  it("creates a password-protected share", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        volume: "v1",
        path: testFile,
        password: "mypass",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share.password_hash).not.toBeNull();
  });

  it("creates a share with max downloads", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        volume: "v1",
        path: testFile,
        maxDownloads: 5,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share.max_downloads).toBe(5);
  });

  it("creates a share with expiration", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        volume: "v1",
        path: testFile,
        expiresIn: 24,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share.expires_at).not.toBeNull();
  });

  it("creates a public share", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        volume: "v1",
        path: testFile,
        isPublic: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share.is_public).toBe(1);
  });

  it("rejects share for inaccessible volume", async () => {
    const token = await setup();
    const privateDir = join(testDir, "private");
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(join(privateDir, "secret.txt"), "secret");
    createTestVolume("v2", "Private", privateDir, "private");

    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ volume: "v2", path: "secret.txt" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects share for non-existent volume", async () => {
    const token = await setup();
    const res = await app.request(API, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ volume: "nope", path: testFile }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/share (list)", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(API);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no shares exist", async () => {
    const token = await setup();
    const res = await app.request(API, {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shares).toEqual([]);
  });

  it("returns only the authenticated user's shares", async () => {
    const token = await setup();
    createTestUser("u2", "bob");
    createShareLink({ userId: "u1", volume: "v1", path: testFile });
    createShareLink({ userId: "u1", volume: "v1", path: testFile });
    createShareLink({ userId: "u2", volume: "v1", path: testFile });

    const res = await app.request(API, {
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shares).toHaveLength(2);
    expect(body.shares.every((s: any) => s.user_id === "u1")).toBe(true);
  });
});

describe("DELETE /api/v1/share/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(`${API}/someid`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("deletes own share", async () => {
    const token = await setup();
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
    });

    const res = await app.request(`${API}/${link.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(res.status).toBe(200);

    // Verify it's gone
    const infoRes = await app.request(`${API}/${link.id}/info`);
    expect(infoRes.status).toBe(404);
  });

  it("cannot delete another user's share", async () => {
    const token = await setup();
    createTestUser("u2", "bob");
    const link = createShareLink({
      userId: "u2",
      volume: "v1",
      path: testFile,
    });

    const res = await app.request(`${API}/${link.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent share", async () => {
    const token = await setup();
    const res = await app.request(`${API}/nonexistent`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Public share server (separate Hono app on different port)
// ---------------------------------------------------------------------------

describe("publicShareApp - GET /s/:id", () => {
  it("downloads a public share without auth", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      isPublic: true,
    });

    const res = await publicShareApp.request(`/s/${link.id}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(testFileContent);
  });

  it("rejects non-public shares", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      isPublic: false,
    });

    const res = await publicShareApp.request(`/s/${link.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent share", async () => {
    const res = await publicShareApp.request("/s/nonexistent");
    expect(res.status).toBe(404);
  });

  it("enforces password on public shares", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      password: "secret",
      isPublic: true,
    });

    // No password
    const res1 = await publicShareApp.request(`/s/${link.id}`);
    expect(res1.status).toBe(403);

    // Wrong password
    const res2 = await publicShareApp.request(
      `/s/${link.id}?password=wrong`
    );
    expect(res2.status).toBe(403);

    // Correct password
    const res3 = await publicShareApp.request(
      `/s/${link.id}?password=secret`
    );
    expect(res3.status).toBe(200);
    const text = await res3.text();
    expect(text).toBe(testFileContent);
  });

  it("rejects expired public share", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);

    const { getDb } = await import("../../src/db/index.js");
    const db = getDb();
    const past = new Date(Date.now() - 60_000).toISOString();
    db.prepare(
      `INSERT INTO share_links (id, user_id, volume, path, is_public, expires_at)
       VALUES ('pub-expired', 'u1', 'v1', ?, 1, ?)`
    ).run(testFile, past);

    const res = await publicShareApp.request("/s/pub-expired");
    expect(res.status).toBe(403);
  });
});

describe("publicShareApp - GET /s/:id/info", () => {
  it("returns info for public share", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      isPublic: true,
    });

    const res = await publicShareApp.request(`/s/${link.id}/info`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(link.id);
    expect(body.filename).toBe(testFile);
  });

  it("rejects non-public shares", async () => {
    createTestUser("u1", "alice");
    createTestVolume("v1", "Test", testDir);
    const link = createShareLink({
      userId: "u1",
      volume: "v1",
      path: testFile,
      isPublic: false,
    });

    const res = await publicShareApp.request(`/s/${link.id}/info`);
    expect(res.status).toBe(404);
  });
});
