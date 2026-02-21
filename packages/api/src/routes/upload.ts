import { Hono } from "hono";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getVolume, resolveVolumePath } from "../services/filesystem.js";
import { canAccessVolume } from "../services/access.js";

// Ensure staging directory exists
fs.mkdirSync(config.uploadStagingDir, { recursive: true });

const tusServer = new Server({
  path: "/api/v1/upload",
  datastore: new FileStore({
    directory: config.uploadStagingDir,
  }),
  respectForwardedHeaders: true,
  onUploadFinish: async (req, res, upload) => {
    // Parse metadata to determine target location
    const metadata = upload.metadata;
    if (!metadata) return res;

    const volumeId = metadata.volume;
    const targetDir = metadata.directory || "";
    const fileName = metadata.filename || upload.id;

    if (!volumeId) return res;

    try {
      const volume = getVolume(volumeId);
      const targetPath = resolveVolumePath(
        volume,
        path.join(targetDir, fileName)
      );

      // Ensure parent directory exists
      const parentDir = path.dirname(targetPath);
      fs.mkdirSync(parentDir, { recursive: true });

      // Move file from staging to target
      const stagingPath = path.join(config.uploadStagingDir, upload.id);
      fs.renameSync(stagingPath, targetPath);

      // Clean up .json metadata file
      const metaPath = `${stagingPath}.json`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
    } catch (err) {
      console.error("Error moving uploaded file:", err);
    }

    return res;
  },
});

const upload = new Hono();

// Validate volume access on upload creation (POST)
upload.post("/*", async (c, next) => {
  const session = c.get("session" as never) as { sub: string };
  const uploadMetadata = c.req.header("upload-metadata");
  if (uploadMetadata) {
    // TUS metadata is comma-separated key-value pairs, values are base64-encoded
    const parts = uploadMetadata.split(",").map((p) => p.trim());
    for (const part of parts) {
      const [key, value] = part.split(" ");
      if (key === "volume" && value) {
        const volumeId = Buffer.from(value, "base64").toString("utf-8");
        getVolume(volumeId, session.sub); // throws 403 if denied
      }
    }
  }
  await next();
});

// Bridge all tus methods to the tus server using raw Node.js req/res
upload.all("/*", async (c) => {
  const req = c.env.incoming;
  const res = c.env.outgoing;

  if (!req || !res) {
    return c.json({ error: "Upload requires Node.js server" }, 500);
  }

  await tusServer.handle(req, res);
  return new Response(null); // Response already sent via res
});

export default upload;

// Cleanup abandoned uploads older than 24 hours
export function cleanupStagingDir() {
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  try {
    const files = fs.readdirSync(config.uploadStagingDir);
    for (const file of files) {
      const filePath = path.join(config.uploadStagingDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
