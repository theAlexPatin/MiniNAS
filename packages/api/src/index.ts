import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { scanVolume, startWatchers } from "./services/indexer.js";
import { getVolumes, migrateEnvVolumes } from "./services/volumes.js";
import { publicShareApp } from "./public-share-server.js";

// Initialize database
getDb();

// Migrate volumes from env var to DB (one-time)
migrateEnvVolumes();

const volumes = getVolumes();

console.log(`MiniNAS API starting on port ${config.port}`);
console.log(
  `Configured volumes: ${volumes.map((v) => `${v.id} (${v.path})`).join(", ") || "none"}`
);

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`MiniNAS API ready at http://localhost:${config.port}`);

if (config.publicSharePort > 0) {
  serve({
    fetch: publicShareApp.fetch,
    port: config.publicSharePort,
  });
  console.log(`Public share server ready at http://localhost:${config.publicSharePort}`);
}

if (config.baseUrl) {
  console.log(`External access: ${config.baseUrl}`);
}
if (config.publicShareUrl) {
  console.log(`Public share URL: ${config.publicShareUrl}`);
}

// Start file indexing in background (don't block server startup)
setTimeout(() => {
  for (const volume of getVolumes()) {
    scanVolume(volume);
  }
  startWatchers();
}, 1000);
