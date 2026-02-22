import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { spawn } from "node:child_process";
import {
  listUsers,
  deleteUser,
  getVolumeAccessList,
  grantVolumeAccess,
  revokeVolumeAccess,
  setVolumeVisibility,
  getUserById,
} from "../services/access.js";
import {
  createInvite,
  listInvites,
  deleteInvite,
} from "../services/invites.js";
import { getVolumeById } from "../services/volumes.js";
import { config } from "../config.js";

const admin = new Hono();

// --- Users ---

admin.get("/users", (c) => {
  const users = listUsers();
  return c.json({ users });
});

admin.delete("/users/:id", (c) => {
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

admin.get("/invites", (c) => {
  const invites = listInvites();
  return c.json({ invites });
});

admin.delete("/invites/:id", (c) => {
  const id = c.req.param("id");
  const deleted = deleteInvite(id);
  if (!deleted) {
    throw new HTTPException(404, { message: "Invite not found" });
  }
  return c.json({ ok: true });
});

// --- Volume visibility ---

admin.patch("/volumes/:id/visibility", async (c) => {
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

admin.get("/volumes/:id/access", (c) => {
  const volumeId = c.req.param("id");
  const volume = getVolumeById(volumeId);
  if (!volume) {
    throw new HTTPException(404, { message: "Volume not found" });
  }

  const users = getVolumeAccessList(volumeId);
  return c.json({ users });
});

admin.post("/volumes/:id/access", async (c) => {
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

admin.delete("/volumes/:id/access/:userId", (c) => {
  const volumeId = c.req.param("id");
  const userId = c.req.param("userId");

  revokeVolumeAccess(volumeId, userId);
  return c.json({ ok: true });
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
