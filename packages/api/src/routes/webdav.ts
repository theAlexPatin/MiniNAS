import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import mime from "mime-types";
import {
  getVolume,
  resolveVolumePath,
  listDirectory,
  deleteEntry,
  moveEntry,
  copyEntry,
  createDirectory,
} from "../services/filesystem.js";
import { getVolumes } from "../services/volumes.js";
import { getAccessibleVolumeIds } from "../services/access.js";
import { audit } from "../services/audit-log.js";
import {
  multistatus,
  lockResponse,
  proppatchResponse,
  parsePropfindBody,
  parseLockBody,
  type DavResource,
} from "../lib/webdav-xml.js";

const webdav = new Hono();

// Return plain-text errors so macOS Finder / Windows Explorer don't choke on JSON bodies.
webdav.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.body(err.message, err.status);
  }
  console.error("WebDAV error:", err);
  return c.body("Internal Server Error", 500);
});

// --- In-memory lock store ---

interface Lock {
  token: string;
  owner: string;
  timeout: number;
  createdAt: number;
}

const locks = new Map<string, Lock>();

// Clean expired locks every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, lock] of locks) {
    if (now - lock.createdAt > lock.timeout * 1000) {
      locks.delete(key);
    }
  }
}, 10 * 60 * 1000);

// --- Helpers ---

function getSession(c: Context): { sub: string } {
  return c.get("session" as never) as { sub: string };
}

/**
 * Extract the WebDAV-relative path from the full request path.
 * c.req.param("*") doesn't work through nested route() calls,
 * so we strip the leading slash ourselves.
 */
function getDavSubpath(c: Context): string {
  return c.req.path.replace(/^\/dav\//, "").replace(/^\/dav$/, "");
}

function parseDavPath(subpath: string): {
  volumeId: string | null;
  relativePath: string;
} {
  const cleaned = subpath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleaned) {
    return { volumeId: null, relativePath: "" };
  }
  const slash = cleaned.indexOf("/");
  if (slash === -1) {
    return { volumeId: cleaned, relativePath: "" };
  }
  return {
    volumeId: cleaned.slice(0, slash),
    relativePath: cleaned.slice(slash + 1),
  };
}

function parseDestination(
  destHeader: string
): { volumeId: string; relativePath: string } | null {
  try {
    const url = new URL(destHeader);
    const davPath = url.pathname.replace(/^\/dav\//, "").replace(/^\/dav$/, "");
    const parsed = parseDavPath(davPath);
    if (!parsed.volumeId) return null;
    return { volumeId: parsed.volumeId, relativePath: parsed.relativePath };
  } catch {
    const davPath = destHeader.replace(/^\/dav\//, "").replace(/^\/dav$/, "");
    const parsed = parseDavPath(davPath);
    if (!parsed.volumeId) return null;
    return { volumeId: parsed.volumeId, relativePath: parsed.relativePath };
  }
}

function makeEtag(stat: fs.Stats): string {
  return `${stat.size}-${Math.floor(stat.mtimeMs)}`;
}

function ensureTrailingSlash(p: string): string {
  return p.endsWith("/") ? p : p + "/";
}

function davHref(volumeId: string | null, relativePath: string): string {
  if (!volumeId) return "/dav/";
  const base = `/dav/${encodeURI(volumeId)}`;
  if (!relativePath) return base + "/";
  return `${base}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

// --- OPTIONS (all paths) ---

webdav.on("OPTIONS", ["/*", "/"], (c) => {
  c.header("DAV", "1, 2");
  c.header(
    "Allow",
    "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK"
  );
  c.header("MS-Author-Via", "DAV");
  return c.body(null, 200);
});

// --- PROPFIND ---

webdav.on("PROPFIND", ["/*", "/"], async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);
  const depth = c.req.header("Depth") || "1";

  const body = await c.req.text();
  parsePropfindBody(body);

  const resources: DavResource[] = [];

  if (!volumeId) {
    const volumeIds = getAccessibleVolumeIds(session.sub);
    const allVolumes = getVolumes();
    const accessible = allVolumes.filter((v) => volumeIds.includes(v.id));

    resources.push({
      href: "/dav/",
      isCollection: true,
      displayName: "",
      contentLength: 0,
      contentType: "httpd/unix-directory",
      lastModified: new Date().toISOString(),
      etag: "root",
    });

    if (depth !== "0") {
      for (const v of accessible) {
        resources.push({
          href: davHref(v.id, ""),
          isCollection: true,
          displayName: v.label,
          contentLength: 0,
          contentType: "httpd/unix-directory",
          lastModified: new Date().toISOString(),
          etag: `vol-${v.id}`,
        });
      }
    }
  } else {
    const volume = getVolume(volumeId, session.sub);
    const resolved = resolveVolumePath(volume, relativePath || ".");

    const stat = await fsPromises.stat(resolved);

    if (stat.isDirectory()) {
      resources.push({
        href: ensureTrailingSlash(davHref(volumeId, relativePath)),
        isCollection: true,
        displayName: relativePath
          ? path.basename(relativePath)
          : volume.label,
        contentLength: 0,
        contentType: "httpd/unix-directory",
        lastModified: stat.mtime.toISOString(),
        etag: makeEtag(stat),
      });

      if (depth !== "0") {
        const entries = await listDirectory(volume, relativePath || ".", {
          includeDotfiles: true,
        });
        for (const entry of entries) {
          const entryPath = entry.path;
          const href = entry.isDirectory
            ? ensureTrailingSlash(davHref(volumeId, entryPath))
            : davHref(volumeId, entryPath);

          resources.push({
            href,
            isCollection: entry.isDirectory,
            displayName: entry.name,
            contentLength: entry.size,
            contentType: entry.isDirectory
              ? "httpd/unix-directory"
              : entry.mimeType || "application/octet-stream",
            lastModified: entry.modifiedAt,
            etag: `${entry.size}-${new Date(entry.modifiedAt).getTime()}`,
          });
        }
      }
    } else {
      resources.push({
        href: davHref(volumeId, relativePath),
        isCollection: false,
        displayName: path.basename(relativePath),
        contentLength: stat.size,
        contentType:
          mime.lookup(path.basename(relativePath)) ||
          "application/octet-stream",
        lastModified: stat.mtime.toISOString(),
        etag: makeEtag(stat),
      });
    }
  }

  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(multistatus(resources), 207);
});

// --- GET ---

webdav.get("/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);

  if (!volumeId) {
    return c.body("Method not allowed on root collection", 405);
  }

  const volume = getVolume(volumeId, session.sub);
  const filePath = resolveVolumePath(volume, relativePath || ".");
  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    return c.body("Method not allowed on collection", 405);
  }

  const fileName = path.basename(filePath);
  const mimeType = mime.lookup(fileName) || "application/octet-stream";
  const etag = makeEtag(stat);

  const rangeHeader = c.req.header("Range");
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return c.body("Invalid range", 416);

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;

    if (start >= stat.size || end >= stat.size || start > end) {
      c.header("Content-Range", `bytes */${stat.size}`);
      return c.body(null, 416);
    }

    const chunkSize = end - start + 1;
    c.status(206);
    c.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    c.header("Accept-Ranges", "bytes");
    c.header("Content-Length", chunkSize.toString());
    c.header("Content-Type", mimeType);
    c.header("ETag", `"${etag}"`);
    c.header("Last-Modified", stat.mtime.toUTCString());

    return stream(c, async (s) => {
      const readStream = fs.createReadStream(filePath, { start, end });
      for await (const chunk of readStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  }

  c.header("Content-Type", mimeType);
  c.header("Content-Length", stat.size.toString());
  c.header("Accept-Ranges", "bytes");
  c.header("ETag", `"${etag}"`);
  c.header("Last-Modified", stat.mtime.toUTCString());

  return stream(c, async (s) => {
    const readStream = fs.createReadStream(filePath);
    for await (const chunk of readStream) {
      await s.write(chunk as Uint8Array);
    }
  });
});

// --- HEAD ---

webdav.on("HEAD", "/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);

  if (!volumeId) {
    c.header("Content-Type", "httpd/unix-directory");
    return c.body(null, 200);
  }

  const volume = getVolume(volumeId, session.sub);
  const filePath = resolveVolumePath(volume, relativePath || ".");
  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    c.header("Content-Type", "httpd/unix-directory");
    return c.body(null, 200);
  }

  const fileName = path.basename(filePath);
  c.header(
    "Content-Type",
    mime.lookup(fileName) || "application/octet-stream"
  );
  c.header("Content-Length", stat.size.toString());
  c.header("ETag", `"${makeEtag(stat)}"`);
  c.header("Last-Modified", stat.mtime.toUTCString());
  c.header("Accept-Ranges", "bytes");
  return c.body(null, 200);
});

// --- PUT ---

webdav.put("/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);

  if (!volumeId || !relativePath) {
    return c.body("Cannot PUT to root or volume root", 405);
  }

  const volume = getVolume(volumeId, session.sub);
  const filePath = resolveVolumePath(volume, relativePath);

  // Ensure parent directory exists
  const parentDir = path.dirname(filePath);
  await fsPromises.mkdir(parentDir, { recursive: true });

  // Check if file already exists (for status code)
  let existed = false;
  try {
    await fsPromises.access(filePath);
    existed = true;
  } catch {
    // File doesn't exist yet
  }

  // Stream request body to file
  const reqBody = c.req.raw.body;
  if (reqBody) {
    const writeStream = fs.createWriteStream(filePath);
    const reader = reqBody.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writeStream.write(value);
      }
    } finally {
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    }
  } else {
    await fsPromises.writeFile(filePath, "");
  }

  audit({ action: "file.create", userId: session.sub, source: "webdav", volumeId, path: relativePath });
  return c.body(null, existed ? 204 : 201);
});

// --- DELETE ---

webdav.delete("/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);

  if (!volumeId) {
    return c.body("Cannot delete root", 403);
  }

  const volume = getVolume(volumeId, session.sub);
  await deleteEntry(volume, relativePath || ".");
  audit({ action: "file.delete", userId: session.sub, source: "webdav", volumeId, path: relativePath || "." });
  return c.body(null, 204);
});

// --- MKCOL ---

webdav.on("MKCOL", "/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);

  if (!volumeId || !relativePath) {
    return c.body("Cannot create collection at root", 405);
  }

  const volume = getVolume(volumeId, session.sub);
  const name = path.basename(relativePath);
  const parentPath = path.dirname(relativePath);

  await createDirectory(volume, parentPath === "." ? "" : parentPath, name);
  audit({ action: "dir.create", userId: session.sub, source: "webdav", volumeId, path: relativePath });
  return c.body(null, 201);
});

// --- MOVE ---

webdav.on("MOVE", "/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);
  const destHeader = c.req.header("Destination");

  if (!volumeId || !destHeader) {
    return c.body("Bad request", 400);
  }

  const dest = parseDestination(destHeader);
  if (!dest) {
    return c.body("Invalid destination", 400);
  }

  if (dest.volumeId !== volumeId) {
    return c.body("Cross-volume moves are not supported", 502);
  }

  const volume = getVolume(volumeId, session.sub);
  await moveEntry(volume, relativePath || ".", dest.relativePath);
  audit({ action: "file.move", userId: session.sub, source: "webdav", volumeId, path: relativePath || ".", dest: dest.relativePath });
  return c.body(null, 204);
});

// --- COPY ---

webdav.on("COPY", "/*", async (c) => {
  const session = getSession(c);
  const subpath = getDavSubpath(c);
  const { volumeId, relativePath } = parseDavPath(subpath);
  const destHeader = c.req.header("Destination");

  if (!volumeId || !destHeader) {
    return c.body("Bad request", 400);
  }

  const dest = parseDestination(destHeader);
  if (!dest) {
    return c.body("Invalid destination", 400);
  }

  if (dest.volumeId !== volumeId) {
    return c.body("Cross-volume copies are not supported", 502);
  }

  const volume = getVolume(volumeId, session.sub);
  await copyEntry(volume, relativePath || ".", dest.relativePath);
  audit({ action: "file.copy", userId: session.sub, source: "webdav", volumeId, path: relativePath || ".", dest: dest.relativePath });
  return c.body(null, 201);
});

// --- LOCK ---

webdav.on("LOCK", "/*", async (c) => {
  const reqBody = await c.req.text();
  const lockReq = parseLockBody(reqBody);
  const token = `opaquelocktoken:${nanoid()}`;
  const timeout = 1800; // 30 minutes

  const subpath = getDavSubpath(c);
  locks.set(subpath, {
    token,
    owner: lockReq.owner,
    timeout,
    createdAt: Date.now(),
  });

  c.header("Content-Type", "application/xml; charset=utf-8");
  c.header("Lock-Token", `<${token}>`);
  return c.body(lockResponse(token, lockReq.owner, timeout), 200);
});

// --- UNLOCK ---

webdav.on("UNLOCK", "/*", async (c) => {
  const lockToken = c.req.header("Lock-Token")?.replace(/[<>]/g, "");
  if (lockToken) {
    for (const [key, lock] of locks) {
      if (lock.token === lockToken) {
        locks.delete(key);
        break;
      }
    }
  }
  return c.body(null, 204);
});

// --- PROPPATCH ---

webdav.on("PROPPATCH", "/*", async (c) => {
  const subpath = getDavSubpath(c);
  const href = "/dav/" + subpath;
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(proppatchResponse(href), 207);
});

export default webdav;
