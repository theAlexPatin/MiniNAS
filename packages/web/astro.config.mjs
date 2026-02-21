import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [react(), tailwind()],
  server: { port: 4321 },
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
    ],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
        "/dav": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  },
});
