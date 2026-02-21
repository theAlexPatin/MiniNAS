import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { verifySession } from "../services/sessions.js";

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "session");

  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const session = await verifySession(token);
  if (!session) {
    throw new HTTPException(401, { message: "Session expired" });
  }

  c.set("session" as never, session as never);
  await next();
});

// Optional auth - sets session if present but doesn't require it
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "session");
  if (token) {
    const session = await verifySession(token);
    if (session) {
      c.set("session" as never, session as never);
    }
  }
  await next();
});
