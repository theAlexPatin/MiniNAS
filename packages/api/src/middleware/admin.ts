import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { isAdmin } from "../services/access.js";

export const adminMiddleware = createMiddleware(async (c, next) => {
  const session = c.get("session" as never) as { sub: string };
  if (!isAdmin(session.sub)) {
    throw new HTTPException(403, { message: "Admin access required" });
  }
  await next();
});
