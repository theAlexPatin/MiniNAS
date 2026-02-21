import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SearchQuerySchema } from "../types/api.js";
import { searchFiles, searchFilesInVolumes } from "../services/indexer.js";
import { canAccessVolume, getAccessibleVolumeIds } from "../services/access.js";

const search = new Hono();

search.get("/", zValidator("query", SearchQuerySchema), async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const { q, volume } = c.req.valid("query");

  if (volume) {
    if (!canAccessVolume(session.sub, volume)) {
      return c.json({ results: [] });
    }
    const results = searchFiles(q, volume);
    return c.json({ results });
  }

  const accessibleIds = getAccessibleVolumeIds(session.sub);
  const results = searchFilesInVolumes(q, accessibleIds);
  return c.json({ results });
});

export default search;
