import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "../services/webdav-tokens.js";

export const webdavAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    c.header("WWW-Authenticate", 'Basic realm="MiniNAS WebDAV"');
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    c.header("WWW-Authenticate", 'Basic realm="MiniNAS WebDAV"');
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const username = decoded.slice(0, colonIndex);
  const token = decoded.slice(colonIndex + 1);

  const result = verifyToken(username, token);
  if (!result) {
    c.header("WWW-Authenticate", 'Basic realm="MiniNAS WebDAV"');
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  c.set("session" as never, { sub: result.userId } as never);
  await next();
});
