import { Hono } from "hono";
import { config } from "../config.js";
import { getVolumeStats } from "../services/filesystem.js";

const volumes = new Hono();

volumes.get("/", async (c) => {
  const results = await Promise.allSettled(
    config.volumes.map((v) => getVolumeStats(v))
  );

  const volumeInfos = results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getVolumeStats>>> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);

  return c.json({ volumes: volumeInfos });
});

export default volumes;
