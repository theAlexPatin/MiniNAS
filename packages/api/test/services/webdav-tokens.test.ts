import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestUser } from "../helpers.js";
import {
  createToken,
  verifyToken,
  listTokens,
  revokeToken,
} from "../../src/services/webdav-tokens.js";

beforeEach(() => resetDb());

describe("createToken", () => {
  it("returns id and raw token", () => {
    createTestUser("u1", "alice");
    const result = createToken("u1", "My Mac");
    expect(result.id).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(20);
  });
});

describe("verifyToken", () => {
  it("returns userId for valid credentials", () => {
    createTestUser("u1", "alice");
    const { token } = createToken("u1", "Test");
    const result = verifyToken("alice", token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("u1");
  });

  it("returns null for wrong token", () => {
    createTestUser("u1", "alice");
    createToken("u1", "Test");
    expect(verifyToken("alice", "wrong-token")).toBeNull();
  });

  it("returns null for wrong username", () => {
    createTestUser("u1", "alice");
    const { token } = createToken("u1", "Test");
    expect(verifyToken("bob", token)).toBeNull();
  });

  it("updates last_used_at on verify", () => {
    createTestUser("u1", "alice");
    const { id, token } = createToken("u1", "Test");
    verifyToken("alice", token);
    const tokens = listTokens("u1");
    const t = tokens.find((tok) => tok.id === id);
    expect(t!.last_used_at).not.toBeNull();
  });
});

describe("listTokens", () => {
  it("returns tokens without hash", () => {
    createTestUser("u1", "alice");
    createToken("u1", "Mac");
    createToken("u1", "Phone");
    const tokens = listTokens("u1");
    expect(tokens).toHaveLength(2);
    // Should NOT include token_hash
    for (const t of tokens) {
      expect(t).not.toHaveProperty("token_hash");
    }
  });

  it("returns only specified user's tokens", () => {
    createTestUser("u1", "alice");
    createTestUser("u2", "bob");
    createToken("u1", "Alice Token");
    createToken("u2", "Bob Token");
    expect(listTokens("u1")).toHaveLength(1);
    expect(listTokens("u2")).toHaveLength(1);
  });
});

describe("revokeToken", () => {
  it("revokes own token", () => {
    createTestUser("u1", "alice");
    const { id, token } = createToken("u1", "Test");
    expect(revokeToken(id, "u1")).toBe(true);
    expect(verifyToken("alice", token)).toBeNull();
  });

  it("cannot revoke another user's token", () => {
    createTestUser("u1", "alice");
    createTestUser("u2", "bob");
    const { id } = createToken("u1", "Test");
    expect(revokeToken(id, "u2")).toBe(false);
  });
});
