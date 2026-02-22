import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { stream } from "hono/streaming";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";
import { CreateShareSchema } from "../types/api.js";
import { config } from "../config.js";
import { getVolume, resolveVolumePath } from "../services/filesystem.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createShareLink,
  getShareLink,
  validateShareLink,
  incrementDownloadCount,
  listUserShares,
  deleteShareLink,
} from "../services/share.js";

function getShareUrl(shareId: string, isPublic: boolean): string | null {
  if (isPublic && config.publicShareUrl) {
    return `${config.publicShareUrl}/s/${shareId}`;
  }
  if (config.baseUrl) {
    return `${config.baseUrl}/api/v1/share/${shareId}/download`;
  }
  return null;
}

const share = new Hono();

// Public endpoints first (no auth)

// Public download
share.get("/:id/download", async (c) => {
  const id = c.req.param("id");
  const password = c.req.query("password");

  const link = getShareLink(id);
  if (!link) {
    return c.json({ error: "Share not found" }, 404);
  }

  const validation = validateShareLink(link, password);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 403);
  }

  const volume = getVolume(link.volume);
  const filePath = resolveVolumePath(volume, link.path);

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return c.json({ error: "Cannot download directories via share link" }, 400);
  }

  incrementDownloadCount(link.id);

  const fileName = path.basename(filePath);
  const mimeType = mime.lookup(fileName) || "application/octet-stream";

  c.header("Content-Type", mimeType);
  c.header("Content-Length", stat.size.toString());
  c.header("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);

  return stream(c, async (s) => {
    const readStream = fs.createReadStream(filePath);
    for await (const chunk of readStream) {
      await s.write(chunk as Uint8Array);
    }
  });
});

// Public share info
share.get("/:id/info", async (c) => {
  const id = c.req.param("id");
  const link = getShareLink(id);
  if (!link) {
    return c.json({ error: "Share not found" }, 404);
  }

  return c.json({
    id: link.id,
    filename: path.basename(link.path),
    hasPassword: !!link.password_hash,
    expiresAt: link.expires_at,
  });
});

// Auth-protected endpoints

// Create share link
share.post(
  "/",
  authMiddleware,
  zValidator("json", CreateShareSchema),
  async (c) => {
    const session = c.get("session" as never) as { sub: string };
    const body = c.req.valid("json");

    const volume = getVolume(body.volume, session.sub);
    resolveVolumePath(volume, body.path);

    const link = createShareLink({
      userId: session.sub,
      volume: body.volume,
      path: body.path,
      password: body.password,
      maxDownloads: body.maxDownloads,
      expiresInHours: body.expiresIn,
      isPublic: body.isPublic,
    });

    const url = getShareUrl(link.id, !!link.is_public);
    return c.json({ share: link, ...(url ? { url } : {}) }, 201);
  }
);

// List user's shares
share.get("/", authMiddleware, async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const shares = listUserShares(session.sub);
  const sharesWithUrls = shares.map((s) => ({
    ...s,
    url: getShareUrl(s.id, !!s.is_public),
  }));
  return c.json({ shares: sharesWithUrls });
});

// Delete share
share.delete("/:id", authMiddleware, async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const id = c.req.param("id");
  const deleted = deleteShareLink(id, session.sub);
  if (!deleted) {
    return c.json({ error: "Share not found" }, 404);
  }
  return c.json({ ok: true });
});

export default share;
