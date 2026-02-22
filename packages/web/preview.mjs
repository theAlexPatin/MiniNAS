import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const dist = new URL("./dist", import.meta.url).pathname;
const port = parseInt(process.argv.find((a) => a.match(/^\d+$/)) || "4321");
const host = process.argv.includes("--host") ? "0.0.0.0" : "127.0.0.1";

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};

function tryFile(urlPath) {
  // Try exact path
  let file = join(dist, urlPath);
  if (existsSync(file) && !file.endsWith("/")) return file;
  // Try with index.html
  file = join(dist, urlPath, "index.html");
  if (existsSync(file)) return file;
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = tryFile(url.pathname);

  // SPA fallback: /volumes/X/Y/Z -> /volumes/index.html
  if (!filePath && url.pathname.startsWith("/volumes/") && !extname(url.pathname)) {
    filePath = join(dist, "volumes", "index.html");
  }

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath);
  const mime = mimeTypes[ext] || "application/octet-stream";
  const body = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(body);
}).listen(port, host, () => {
  console.log(`Preview server: http://${host}:${port}/`);
});
