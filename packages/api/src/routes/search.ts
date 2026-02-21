import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SearchQuerySchema } from "../types/api.js";
import { searchFiles } from "../services/indexer.js";

const search = new Hono();

search.get("/", zValidator("query", SearchQuerySchema), async (c) => {
  const { q, volume } = c.req.valid("query");
  const results = searchFiles(q, volume);
  return c.json({ results });
});

export default search;
