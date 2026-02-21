import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { scanVolume, startWatchers } from "./services/indexer.js";

// Initialize database
getDb();

console.log(`MiniNAS API starting on port ${config.port}`);
console.log(
  `Configured volumes: ${config.volumes.map((v) => `${v.id} (${v.path})`).join(", ") || "none"}`
);

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`MiniNAS API ready at http://localhost:${config.port}`);

// Start file indexing in background (don't block server startup)
setTimeout(() => {
  for (const volume of config.volumes) {
    scanVolume(volume);
  }
  startWatchers();
}, 1000);
