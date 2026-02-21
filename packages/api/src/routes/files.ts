import { Hono } from "hono";
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

const files = new Hono();

// List directory or get file metadata
files.get("/:volume/*", async (c) => {
  const volumeId = c.req.param("volume");
  const relativePath = c.req.param("*") || "";
  const volume = getVolume(volumeId);

  const info = await getFileInfo(volume, relativePath || ".");
  if (info.isDirectory) {
    const entries = await listDirectory(volume, relativePath || ".");
    return c.json({ entries, path: relativePath, volume: volumeId });
  }
  return c.json(info);
});

// Delete file or directory
files.delete("/:volume/*", async (c) => {
  const volumeId = c.req.param("volume");
  const relativePath = c.req.param("*") || "";
  const volume = getVolume(volumeId);

  if (!relativePath) {
    return c.json({ error: "Cannot delete volume root" }, 403);
  }

  await deleteEntry(volume, relativePath);
  return c.json({ ok: true });
});

// Rename or move
files.patch(
  "/:volume/*",
  zValidator("json", MoveRequestSchema),
  async (c) => {
    const volumeId = c.req.param("volume");
    const relativePath = c.req.param("*") || "";
    const volume = getVolume(volumeId);
    const { destination } = c.req.valid("json");

    if (!relativePath) {
      return c.json({ error: "Cannot move volume root" }, 403);
    }

    await moveEntry(volume, relativePath, destination);
    return c.json({ ok: true });
  }
);

// Create directory
files.post(
  "/:volume/*",
  zValidator("json", MkdirRequestSchema),
  async (c) => {
    const volumeId = c.req.param("volume");
    const parentPath = c.req.param("*") || "";
    const volume = getVolume(volumeId);
    const { name } = c.req.valid("json");

    await createDirectory(volume, parentPath || ".", name);
    return c.json({ ok: true }, 201);
  }
);

export default files;
