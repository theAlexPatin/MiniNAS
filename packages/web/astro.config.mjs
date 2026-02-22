import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import http from "node:http";

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [react(), tailwind()],
  server: { port: 4321, host: "0.0.0.0" },
  vite: {
    plugins: [
      {
        name: "volumes-spa-fallback",
        configureServer(server) {
          // Rewrite /volumes/X/Y/Z to /volumes so Astro serves the
          // catch-all [...path].astro page for all sub-paths in dev mode.
          server.middlewares.use((req, _res, next) => {
            if (
              req.url &&
              req.url.startsWith("/volumes/") &&
              !req.url.includes(".")
            ) {
              req.url = "/volumes";
            }
            next();
          });
        },
      },
      {
        name: "webdav-proxy",
        configureServer(server) {
          // Raw HTTP proxy for /dav so that WebDAV methods (OPTIONS,
          // PROPFIND, LOCK, etc.) are forwarded before Vite's built-in
          // CORS/OPTIONS handling can intercept them.
          server.middlewares.use((req, res, next) => {
            if (!req.url || !req.url.startsWith("/dav")) {
              return next();
            }
            const proxyReq = http.request(
              {
                hostname: "localhost",
                port: 3001,
                path: req.url,
                method: req.method,
                headers: { ...req.headers, host: "localhost:3001" },
              },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
              }
            );
            proxyReq.on("error", () => {
              res.writeHead(502);
              res.end("Bad Gateway");
            });
            req.pipe(proxyReq);
          });
        },
      },
    ],
    server: {
      allowedHosts: [".ts.net"],
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  },
});
