import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { spawn } from "node:child_process";
import { createInvite } from "../services/invites.js";
import { createManagementRoutes } from "./management.js";
import { config } from "../config.js";

const admin = new Hono();

// Shared management routes (users, invites list/delete, volume visibility/access)
admin.route("/", createManagementRoutes());

// --- Invites (admin-specific: uses session.sub as creator) ---

admin.post("/invites", async (c) => {
  const session = c.get("session" as never) as { sub: string };
  const body = await c.req.json();
  const { username, expiresInHours } = body;

  if (!username || typeof username !== "string") {
    throw new HTTPException(400, { message: "username is required" });
  }

  const invite = createInvite(session.sub, username, expiresInHours);
  return c.json({ invite }, 201);
});

// --- Version & Update ---

admin.get("/version", (c) => {
  return c.json({ version: config.version });
});

admin.post("/update", async (c) => {
  // Spawn detached upgrade + restart — returns immediately
  const child = spawn("bash", ["-c", "brew upgrade mininas && brew services restart mininas"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return c.json({ ok: true, message: "Update started. The server will restart shortly." });
});

export default admin;
