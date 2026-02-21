import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getVolumeById,
  addVolume,
  removeVolume,
} from "../services/volumes.js";
import {
  listUsers,
  deleteUser,
  getUserById,
  setVolumeVisibility,
  getVolumeAccessList,
  grantVolumeAccess,
  revokeVolumeAccess,
} from "../services/access.js";
import {
  createInvite,
  listInvites,
  deleteInvite,
} from "../services/invites.js";
import { getDb } from "../db/index.js";

const cli = new Hono();

// --- Volumes ---

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

// --- Volume visibility ---

cli.patch("/volumes/:id/visibility", async (c) => {
  const volumeId = c.req.param("id");
  const volume = getVolumeById(volumeId);
  if (!volume) {
    throw new HTTPException(404, { message: "Volume not found" });
  }

  const body = await c.req.json();
  const { visibility } = body;
  if (visibility !== "public" && visibility !== "private") {
    throw new HTTPException(400, {
      message: "visibility must be 'public' or 'private'",
    });
  }

  setVolumeVisibility(volumeId, visibility);
  return c.json({ ok: true });
});

// --- Volume access ---

cli.get("/volumes/:id/access", (c) => {
  const volumeId = c.req.param("id");
  const volume = getVolumeById(volumeId);
  if (!volume) {
    throw new HTTPException(404, { message: "Volume not found" });
  }

  const users = getVolumeAccessList(volumeId);
  return c.json({ users });
});

cli.post("/volumes/:id/access", async (c) => {
  const volumeId = c.req.param("id");
  const volume = getVolumeById(volumeId);
  if (!volume) {
    throw new HTTPException(404, { message: "Volume not found" });
  }

  const body = await c.req.json();
  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    throw new HTTPException(400, { message: "userId is required" });
  }

  const user = getUserById(userId);
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  grantVolumeAccess(volumeId, userId);
  return c.json({ ok: true }, 201);
});

cli.delete("/volumes/:id/access/:userId", (c) => {
  const volumeId = c.req.param("id");
  const userId = c.req.param("userId");

  revokeVolumeAccess(volumeId, userId);
  return c.json({ ok: true });
});

// --- Users ---

cli.get("/users", (c) => {
  const users = listUsers();
  return c.json({ users });
});

cli.delete("/users/:id", (c) => {
  const userId = c.req.param("id");
  const deleted = deleteUser(userId);
  if (!deleted) {
    throw new HTTPException(400, {
      message: "User not found or cannot delete admin",
    });
  }
  return c.json({ ok: true });
});

// --- Invites ---

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

cli.get("/invites", (c) => {
  const invites = listInvites();
  return c.json({ invites });
});

cli.delete("/invites/:id", (c) => {
  const id = c.req.param("id");
  const deleted = deleteInvite(id);
  if (!deleted) {
    throw new HTTPException(404, { message: "Invite not found" });
  }
  return c.json({ ok: true });
});

export default cli;
