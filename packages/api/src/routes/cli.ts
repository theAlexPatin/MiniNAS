import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getVolumeById,
  addVolume,
  removeVolume,
} from "../services/volumes.js";
import {
  getUserById,
  resetPasskeys,
} from "../services/access.js";
import { createInvite } from "../services/invites.js";
import { createManagementRoutes } from "./management.js";
import { getDb } from "../db/index.js";

const cli = new Hono();

// Shared management routes (users, invites list/delete, volume visibility/access)
cli.route("/", createManagementRoutes());

// --- Volumes (CLI-specific: full CRUD) ---

cli.get("/volumes", (c) => {
  const db = getDb();
  const volumes = db
    .prepare("SELECT id, label, path, visibility FROM volumes ORDER BY rowid")
    .all();
  return c.json({ volumes });
});

cli.post("/volumes", async (c) => {
  const body = await c.req.json();
  const { id, label, path } = body;

  if (!id || !label || !path) {
    throw new HTTPException(400, {
      message: "id, label, and path are required",
    });
  }

  try {
    addVolume(id, label, path);
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      throw new HTTPException(409, {
        message: `Volume with id '${id}' already exists`,
      });
    }
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HTTPException(409, {
        message: `A volume with that path already exists`,
      });
    }
    throw new HTTPException(400, { message: err.message });
  }

  return c.json({ ok: true, id }, 201);
});

cli.delete("/volumes/:id", (c) => {
  const id = c.req.param("id");
  const volume = getVolumeById(id);
  if (!volume) {
    throw new HTTPException(404, { message: `Volume '${id}' not found` });
  }

  removeVolume(id);
  return c.json({ ok: true, volume });
});

// --- Users (CLI-specific: reset passkeys) ---

cli.post("/users/:id/reset-passkeys", (c) => {
  const userId = c.req.param("id");
  const user = getUserById(userId);
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  const count = resetPasskeys(userId);
  return c.json({ ok: true, username: user.username, removedCredentials: count });
});

// --- Invites (CLI-specific: auto-selects admin as creator) ---

cli.post("/invites", async (c) => {
  const body = await c.req.json();
  const { username, expiresInHours } = body;

  if (!username || typeof username !== "string") {
    throw new HTTPException(400, { message: "username is required" });
  }

  // Auto-select first admin user as creator
  const db = getDb();
  const admin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string } | undefined;
  if (!admin) {
    throw new HTTPException(400, {
      message: "No admin user found. Run setup first.",
    });
  }

  const invite = createInvite(admin.id, username, expiresInHours);
  return c.json({ invite }, 201);
});

export default cli;
