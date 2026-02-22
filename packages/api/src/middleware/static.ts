import { createMiddleware } from "hono/factory";
import fs from "node:fs";
import path from "node:path";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function tryFile(distDir: string, urlPath: string): string | null {
  let file = path.join(distDir, urlPath);
  if (isFile(file)) return file;
  file = path.join(distDir, urlPath, "index.html");
  if (isFile(file)) return file;
  return null;
}

export function createStaticMiddleware(distDir: string) {
  return createMiddleware(async (c, next) => {
    // Only handle GET/HEAD
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return next();
    }

    const url = new URL(c.req.url);
    const pathname = url.pathname;

    // Skip API and WebDAV routes
    if (pathname.startsWith("/api/") || pathname.startsWith("/dav/") || pathname.startsWith("/dav")) {
      return next();
    }

    let filePath = tryFile(distDir, pathname);

    // SPA fallback: /volumes/X/Y/Z -> /volumes/index.html
    if (!filePath && pathname.startsWith("/volumes/") && !path.extname(pathname)) {
      filePath = path.join(distDir, "volumes", "index.html");
    }

    if (!filePath) {
      // Try index.html for root
      if (pathname === "/") {
        filePath = path.join(distDir, "index.html");
        if (!isFile(filePath)) return next();
      } else {
        return next();
      }
    }

    const ext = path.extname(filePath);
    const mime = mimeTypes[ext] || "application/octet-stream";
    const body = fs.readFileSync(filePath);
    const cacheControl =
      ext === ".html"
        ? "no-cache"
        : "public, max-age=31536000, immutable";

    return c.body(body, 200, {
      "Content-Type": mime,
      "Cache-Control": cacheControl,
    });
  });
}
