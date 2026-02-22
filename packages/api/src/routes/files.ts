import { Hono } from "hono";
import type { Context } from "hono";
import path from "node:path";
import { zValidator } from "@hono/zod-validator";
import {
  getVolume,
  listDirectory,
  getFileInfo,
  deleteEntry,
  moveEntry,
  createDirectory,
} from "../services/filesystem.js";
import { MoveRequestSchema, MkdirRequestSchema } from "../types/api.js";
import { audit } from "../services/audit-log.js";

const files = new Hono();

/**
 * Extract the relative path after /:volumeId/ from c.req.path.
 * c.req.param("*") doesn't work through nested route() calls in Hono,
 * so we parse c.req.path directly (same approach as the WebDAV router).
 */
function getRelativePath(c: Context): string {
  const volumeId = c.req.param("volumeId");
  const encoded = encodeURIComponent(volumeId);
  const sep = `/${encoded}/`;
  const idx = c.req.path.lastIndexOf(sep);
  if (idx < 0) return "";
  const raw = c.req.path.substring(idx + sep.length);
  return raw.split("/").map(decodeURIComponent).join("/");
}

// --- List directory or get file metadata ---

files.get("/:volumeId", async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const volumeId = c.req.param("volumeId");
  const volume = getVolume(volumeId, session.sub);

  const entries = await listDirectory(volume, ".");
  return c.json({ entries, path: "", volume: volumeId });
});

files.get("/:volumeId/*", async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const volumeId = c.req.param("volumeId");
  const relativePath = getRelativePath(c);
  const volume = getVolume(volumeId, session.sub);

  const info = await getFileInfo(volume, relativePath || ".");
  if (info.isDirectory) {
    const entries = await listDirectory(volume, relativePath || ".");
    return c.json({ entries, path: relativePath, volume: volumeId });
  }
  return c.json(info);
});

// --- Delete file or directory ---

files.delete("/:volumeId", async (c) => {
  return c.json({ error: "Cannot delete volume root" }, 403);
});

files.delete("/:volumeId/*", async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const volumeId = c.req.param("volumeId");
  const relativePath = getRelativePath(c);
  const volume = getVolume(volumeId, session.sub);

  if (!relativePath) {
    return c.json({ error: "Cannot delete volume root" }, 403);
  }

  await deleteEntry(volume, relativePath);
  audit({ action: "file.delete", userId: session.sub, source: "api", volumeId, path: relativePath });
  return c.json({ ok: true });
});

// --- Rename or move ---

files.patch("/:volumeId", async (c) => {
  return c.json({ error: "Cannot move volume root" }, 403);
});

files.patch(
  "/:volumeId/*",
  zValidator("json", MoveRequestSchema),
  async (c) => {
    const session = c.get("session" as never) as { sub: string };
    const volumeId = c.req.param("volumeId");
    const relativePath = getRelativePath(c);
    const volume = getVolume(volumeId, session.sub);
    const { destination } = c.req.valid("json");

    if (!relativePath) {
      return c.json({ error: "Cannot move volume root" }, 403);
    }

    await moveEntry(volume, relativePath, destination);
    audit({ action: "file.move", userId: session.sub, source: "api", volumeId, path: relativePath, dest: destination });
    return c.json({ ok: true });
  }
);

// --- Create directory ---

files.post(
  "/:volumeId",
  zValidator("json", MkdirRequestSchema),
  async (c) => {
    const session = c.get("session" as never) as { sub: string };
    const volumeId = c.req.param("volumeId");
    const volume = getVolume(volumeId, session.sub);
    const { name } = c.req.valid("json");

    await createDirectory(volume, ".", name);
    audit({ action: "dir.create", userId: session.sub, source: "api", volumeId, path: name });
    return c.json({ ok: true }, 201);
  }
);

files.post(
  "/:volumeId/*",
  zValidator("json", MkdirRequestSchema),
  async (c) => {
    const session = c.get("session" as never) as { sub: string };
    const volumeId = c.req.param("volumeId");
    const relativePath = getRelativePath(c);
    const volume = getVolume(volumeId, session.sub);
    const { name } = c.req.valid("json");

    await createDirectory(volume, relativePath || ".", name);
    audit({ action: "dir.create", userId: session.sub, source: "api", volumeId, path: path.join(relativePath || ".", name) });
    return c.json({ ok: true }, 201);
  }
);

export default files;
