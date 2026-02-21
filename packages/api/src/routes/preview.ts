import { Hono } from "hono";
import fs from "node:fs";
import mime from "mime-types";
import { getVolume, resolveVolumePath } from "../services/filesystem.js";
import {
  getThumbnailPath,
  type ThumbnailSize,
} from "../services/thumbnails.js";

const preview = new Hono();

preview.get("/:volume/*", async (c) => {
  const volumeId = c.req.param("volume");
  const relativePath = c.req.param("*") || "";
  const size = (c.req.query("size") || "small") as ThumbnailSize;

  const volume = getVolume(volumeId);
  const filePath = resolveVolumePath(volume, relativePath);
  const mimeType = mime.lookup(filePath) || null;

  const thumbPath = await getThumbnailPath(
    filePath,
    volumeId,
    relativePath,
    mimeType,
    size
  );

  if (!thumbPath || !fs.existsSync(thumbPath)) {
    return c.json({ error: "No preview available" }, 404);
  }

  const data = fs.readFileSync(thumbPath);
  c.header("Content-Type", "image/webp");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(data);
});

export default preview;
