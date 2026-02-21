import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { config } from "../config.js";

export const cliAuthMiddleware = createMiddleware(async (c, next) => {
  if (!config.cliSecret) {
    throw new HTTPException(403, {
      message: "CLI access not configured (set CLI_SECRET)",
    });
  }

  const token = c.req.header("X-CLI-Token");
  if (!token || token !== config.cliSecret) {
    throw new HTTPException(403, { message: "Invalid CLI token" });
  }

  await next();
});
