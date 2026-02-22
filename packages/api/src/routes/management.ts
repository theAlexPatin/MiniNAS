import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
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
  listInvites,
  deleteInvite,
} from "../services/invites.js";
import { getVolumeById } from "../services/volumes.js";

/**
 * Shared management routes used by both admin (web UI) and CLI interfaces.
 * Mount this on any Hono router to get user, invite, and volume management endpoints.
 */
export function createManagementRoutes(): Hono {
  const mgmt = new Hono();

  // --- Users ---

  mgmt.get("/users", (c) => {
    const users = listUsers();
    return c.json({ users });
  });

  mgmt.delete("/users/:id", (c) => {
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

  mgmt.get("/invites", (c) => {
    const invites = listInvites();
    return c.json({ invites });
  });

  mgmt.delete("/invites/:id", (c) => {
    const id = c.req.param("id");
    const deleted = deleteInvite(id);
    if (!deleted) {
      throw new HTTPException(404, { message: "Invite not found" });
    }
    return c.json({ ok: true });
  });

  // --- Volume visibility ---

  mgmt.patch("/volumes/:id/visibility", async (c) => {
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

  mgmt.get("/volumes/:id/access", (c) => {
    const volumeId = c.req.param("id");
    const volume = getVolumeById(volumeId);
    if (!volume) {
      throw new HTTPException(404, { message: "Volume not found" });
    }

    const users = getVolumeAccessList(volumeId);
    return c.json({ users });
  });

  mgmt.post("/volumes/:id/access", async (c) => {
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

  mgmt.delete("/volumes/:id/access/:userId", (c) => {
    const volumeId = c.req.param("id");
    const userId = c.req.param("userId");

    revokeVolumeAccess(volumeId, userId);
    return c.json({ ok: true });
  });

  return mgmt;
}
