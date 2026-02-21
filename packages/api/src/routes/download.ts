import { Hono } from "hono";
import { stream } from "hono/streaming";
import fs from "node:fs";
import path from "node:path";
import { zValidator } from "@hono/zod-validator";
import archiver from "archiver";
import mime from "mime-types";
import { getVolume, resolveVolumePath } from "../services/filesystem.js";
import { ZipDownloadSchema } from "../types/api.js";

const download = new Hono();

// Stream file download with Range header support
download.get("/:volume/*", async (c) => {
  const volumeId = c.req.param("volume");
  const relativePath = c.req.param("*") || "";
  const volume = getVolume(volumeId);
  const filePath = resolveVolumePath(volume, relativePath);

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return c.json({ error: "Cannot download a directory directly" }, 400);
  }

  const fileName = path.basename(filePath);
  const mimeType = mime.lookup(fileName) || "application/octet-stream";
  const fileSize = stat.size;

  const rangeHeader = c.req.header("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return c.json({ error: "Invalid range" }, 416);
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      c.header("Content-Range", `bytes */${fileSize}`);
      return c.body(null, 416);
    }

    const chunkSize = end - start + 1;

    c.status(206);
    c.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    c.header("Accept-Ranges", "bytes");
    c.header("Content-Length", chunkSize.toString());
    c.header("Content-Type", mimeType);

    return stream(c, async (s) => {
      const readStream = fs.createReadStream(filePath, { start, end });
      for await (const chunk of readStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  }

  // Full download
  c.header("Content-Type", mimeType);
  c.header("Content-Length", fileSize.toString());
  c.header("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  c.header("Accept-Ranges", "bytes");

  return stream(c, async (s) => {
    const readStream = fs.createReadStream(filePath);
    for await (const chunk of readStream) {
      await s.write(chunk as Uint8Array);
    }
  });
});

// Multi-file zip download
download.post(
  "/zip",
  zValidator("json", ZipDownloadSchema),
  async (c) => {
    const { volume: volumeId, paths } = c.req.valid("json");
    const volume = getVolume(volumeId);

    c.header("Content-Type", "application/zip");
    c.header(
      "Content-Disposition",
      `attachment; filename="download-${Date.now()}.zip"`
    );

    return stream(c, async (s) => {
      const archive = archiver("zip", { zlib: { level: 1 } }); // Fast compression

      archive.on("data", (chunk: Buffer) => {
        s.write(new Uint8Array(chunk));
      });

      const done = new Promise<void>((resolve, reject) => {
        archive.on("end", resolve);
        archive.on("error", reject);
      });

      for (const relativePath of paths) {
        const fullPath = resolveVolumePath(volume, relativePath);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          archive.directory(fullPath, path.basename(fullPath));
        } else {
          archive.file(fullPath, { name: path.basename(fullPath) });
        }
      }

      archive.finalize();
      await done;
    });
  }
);

export default download;
