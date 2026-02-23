import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createToken,
  listTokens,
  revokeToken,
} from "../services/webdav-tokens.js";
import { getIdentity } from "../security/index.js";

const CreateTokenSchema = z.object({
  label: z.string().min(1).max(100),
});

const tokens = new Hono();

// Create a new WebDAV token
tokens.post("/", zValidator("json", CreateTokenSchema), async (c) => {
  const { userId } = getIdentity(c);
  const { label } = c.req.valid("json");
  const { id, token } = createToken(userId, label);
  return c.json({ id, label, token }, 201);
});

// List user's WebDAV tokens
tokens.get("/", async (c) => {
  const { userId } = getIdentity(c);
  const items = listTokens(userId);
  return c.json({ tokens: items });
});

// Revoke a token
tokens.delete("/:id", async (c) => {
  const { userId } = getIdentity(c);
  const id = c.req.param("id");
  const deleted = revokeToken(id, userId);
  if (!deleted) {
    return c.json({ error: "Token not found" }, 404);
  }
  return c.json({ ok: true });
});

export default tokens;
