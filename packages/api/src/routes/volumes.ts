import { Hono } from "hono";
import { getVolumeStats } from "../services/filesystem.js";
import { getVolumes } from "../services/volumes.js";
import { getAccessibleVolumeIds } from "../services/access.js";

const volumes = new Hono();

volumes.get("/", async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const accessibleIds = new Set(getAccessibleVolumeIds(session.sub));

  const results = await Promise.allSettled(
    getVolumes()
      .filter((v) => accessibleIds.has(v.id))
      .map((v) => getVolumeStats(v))
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
