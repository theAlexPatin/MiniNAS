import { Hono } from "hono";
import { stream } from "hono/streaming";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";
import { getVolume, resolveVolumePath } from "./services/filesystem.js";
import {
  getShareLink,
  validateShareLink,
  incrementDownloadCount,
} from "./services/share.js";

export const publicShareApp = new Hono();

// Download a public share
publicShareApp.get("/s/:id", async (c) => {
  const id = c.req.param("id");
  const password = c.req.query("password");

  const link = getShareLink(id);
  if (!link || !link.is_public) {
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

// Share info (metadata only)
publicShareApp.get("/s/:id/info", async (c) => {
  const id = c.req.param("id");
  const link = getShareLink(id);
  if (!link || !link.is_public) {
    return c.json({ error: "Share not found" }, 404);
  }

  return c.json({
    id: link.id,
    filename: path.basename(link.path),
    hasPassword: !!link.password_hash,
    expiresAt: link.expires_at,
  });
});
