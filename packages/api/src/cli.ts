#!/usr/bin/env node

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root
const envPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

// --- Config ---

const program = new Command();

program
  .name("mininas")
  .description("MiniNAS CLI — manage volumes, users, and invites")
  .option(
    "--url <url>",
    "API server URL",
    process.env.MININAS_URL || "http://localhost:3001"
  )
  .option("--token <token>", "CLI secret token", process.env.CLI_SECRET);

// --- HTTP helpers ---

interface ApiOpts {
  url: string;
  token: string;
}

function getOpts(): ApiOpts {
  const opts = program.opts();
  if (!opts.token) {
    console.error(
      "Error: CLI_SECRET not set. Pass --token or set CLI_SECRET env var."
    );
    process.exit(1);
  }
  return { url: opts.url, token: opts.token };
}

async function api(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<any> {
  const { url, token } = getOpts();
  const res = await fetch(`${url}/api/v1/cli${endpoint}`, {
    method,
    headers: {
      "X-CLI-Token": token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }

  return res.json();
}

// --- Prompt helper ---

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- Volume discovery (local) ---

function discoverVolumes(): { name: string; path: string }[] {
  const volumesDir = "/Volumes";
  if (!fs.existsSync(volumesDir)) return [];
  return fs
    .readdirSync(volumesDir)
    .filter((name) => !name.startsWith("."))
    .map((name) => ({ name, path: path.join(volumesDir, name) }))
    .filter((v) => {
      try {
        fs.accessSync(v.path, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    });
}

// --- Volume commands ---

const volume = program.command("volume").description("Manage storage volumes");
volume.action(() => volume.help());

volume
  .command("list")
  .description("List all configured volumes")
  .action(async () => {
    const data = await api("GET", "/volumes");
    const rows = data.volumes;
    if (rows.length === 0) {
      console.log("No volumes configured.");
      console.log("Add one with: mininas volume add <id> <label> <path>");
      return;
    }
    const idW = Math.max(2, ...rows.map((r: any) => r.id.length));
    const labelW = Math.max(5, ...rows.map((r: any) => r.label.length));
    const visW = Math.max(
      10,
      ...rows.map((r: any) => (r.visibility || "public").length)
    );
    console.log(
      `${"ID".padEnd(idW)}  ${"LABEL".padEnd(labelW)}  ${"VISIBILITY".padEnd(visW)}  PATH`
    );
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(idW)}  ${r.label.padEnd(labelW)}  ${(r.visibility || "public").padEnd(visW)}  ${r.path}`
      );
    }
  });

volume
  .command("add")
  .description("Add a volume (interactive if no arguments)")
  .argument("[id]", "Volume ID")
  .argument("[label]", "Volume label")
  .argument("[path]", "Volume path")
  .action(async (id?: string, label?: string, volumePath?: string) => {
    if (!id) {
      // Interactive mode — discover local volumes, filter out already registered
      const data = await api("GET", "/volumes");
      const registered = new Set(data.volumes.map((v: any) => v.path));
      const available = discoverVolumes().filter(
        (v) => !registered.has(v.path)
      );

      if (available.length === 0) {
        console.log("No unregistered volumes found in /Volumes/.");
        console.log(
          "You can add one manually: mininas volume add <id> <label> <path>"
        );
        return;
      }

      console.log("\nAvailable volumes:\n");
      for (let i = 0; i < available.length; i++) {
        console.log(
          `  ${i + 1}) ${available[i].name}  (${available[i].path})`
        );
      }
      console.log();

      const choice = await prompt(
        `Select a volume (1-${available.length}): `
      );
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= available.length) {
        console.error("Invalid selection.");
        process.exit(1);
      }

      const selected = available[idx];
      const defaultId = selected.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const chosenId =
        (await prompt(`Volume ID [${defaultId}]: `)) || defaultId;
      const chosenLabel =
        (await prompt(`Label [${selected.name}]: `)) || selected.name;

      await api("POST", "/volumes", {
        id: chosenId,
        label: chosenLabel,
        path: selected.path,
      });
      console.log(
        `\nAdded volume: ${chosenId} (${chosenLabel}) -> ${selected.path}`
      );
      console.log("Restart the server to pick up changes.");
      return;
    }

    // Explicit mode
    if (!label || !volumePath) {
      console.error("Usage: mininas volume add <id> <label> <path>");
      process.exit(1);
    }
    const resolved = path.resolve(volumePath);
    await api("POST", "/volumes", { id, label, path: resolved });
    console.log(`Added volume: ${id} (${label}) -> ${resolved}`);
    console.log("Restart the server to pick up changes.");
  });

volume
  .command("remove")
  .description("Remove a volume")
  .argument("<id>", "Volume ID")
  .action(async (id: string) => {
    const data = await api("DELETE", `/volumes/${id}`);
    const v = data.volume;
    console.log(`Removed volume: ${v.id} (${v.label}) -> ${v.path}`);
    console.log("Restart the server to pick up changes.");
  });

volume
  .command("visibility")
  .description("Set volume visibility")
  .argument("<id>", "Volume ID")
  .argument("<visibility>", "public or private")
  .action(async (id: string, visibility: string) => {
    if (visibility !== "public" && visibility !== "private") {
      console.error(
        "Usage: mininas volume visibility <id> <public|private>"
      );
      process.exit(1);
    }
    await api("PATCH", `/volumes/${id}/visibility`, { visibility });
    console.log(`Volume '${id}' visibility set to '${visibility}'.`);
  });

// Volume access subcommand
const access = volume
  .command("access")
  .description("Manage volume access");
access.action(() => access.help());

access
  .command("list")
  .description("List users with access to a volume")
  .argument("<volumeId>", "Volume ID")
  .action(async (volumeId: string) => {
    const data = await api("GET", `/volumes/${volumeId}/access`);
    const rows = data.users;
    if (rows.length === 0) {
      console.log(
        `No explicit access grants for volume '${volumeId}'.`
      );
      return;
    }
    const idW = Math.max(2, ...rows.map((r: any) => r.id.length));
    const nameW = Math.max(
      8,
      ...rows.map((r: any) => r.username.length)
    );
    console.log(
      `${"ID".padEnd(idW)}  ${"USERNAME".padEnd(nameW)}  ROLE`
    );
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(idW)}  ${r.username.padEnd(nameW)}  ${r.role}`
      );
    }
  });

access
  .command("grant")
  .description("Grant a user access to a volume")
  .argument("<volumeId>", "Volume ID")
  .argument("<userId>", "User ID")
  .action(async (volumeId: string, userId: string) => {
    await api("POST", `/volumes/${volumeId}/access`, { userId });
    console.log(
      `Granted access to volume '${volumeId}' for user '${userId}'.`
    );
  });

access
  .command("revoke")
  .description("Revoke a user's access to a volume")
  .argument("<volumeId>", "Volume ID")
  .argument("<userId>", "User ID")
  .action(async (volumeId: string, userId: string) => {
    await api("DELETE", `/volumes/${volumeId}/access/${userId}`);
    console.log(
      `Revoked access to volume '${volumeId}' for user '${userId}'.`
    );
  });

// --- User commands ---

const user = program.command("user").description("Manage users");
user.action(() => user.help());

user
  .command("list")
  .description("List all registered users")
  .action(async () => {
    const data = await api("GET", "/users");
    const rows = data.users;
    if (rows.length === 0) {
      console.log("No users registered.");
      return;
    }
    const idW = Math.max(2, ...rows.map((r: any) => r.id.length));
    const nameW = Math.max(
      8,
      ...rows.map((r: any) => r.username.length)
    );
    const roleW = Math.max(4, ...rows.map((r: any) => r.role.length));
    console.log(
      `${"ID".padEnd(idW)}  ${"USERNAME".padEnd(nameW)}  ${"ROLE".padEnd(roleW)}  CREATED`
    );
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(idW)}  ${r.username.padEnd(nameW)}  ${r.role.padEnd(roleW)}  ${r.created_at}`
      );
    }
  });

user
  .command("delete")
  .description("Delete a user")
  .argument("<id>", "User ID")
  .action(async (id: string) => {
    await api("DELETE", `/users/${id}`);
    console.log(`Deleted user: ${id}`);
  });

// --- Invite commands ---

const invite = program
  .command("invite")
  .description("Manage invite tokens");
invite.action(() => invite.help());

invite
  .command("create")
  .description("Create an invite token")
  .argument("<username>", "Username for the invite")
  .option("--expires <hours>", "Expiration in hours", "72")
  .action(async (username: string, opts: { expires: string }) => {
    const expiresInHours = parseInt(opts.expires, 10);
    if (isNaN(expiresInHours) || expiresInHours <= 0) {
      console.error("--expires must be a positive number of hours.");
      process.exit(1);
    }

    const data = await api("POST", "/invites", {
      username,
      expiresInHours,
    });
    const inv = data.invite;
    console.log(`Invite created for '${username}':`);
    console.log(`  Token: ${inv.id}`);
    console.log(`  Expires: ${inv.expires_at}`);
  });

invite
  .command("list")
  .description("List all invite tokens")
  .action(async () => {
    const data = await api("GET", "/invites");
    const rows = data.invites;
    if (rows.length === 0) {
      console.log("No invites.");
      return;
    }
    const idW = Math.max(5, ...rows.map((r: any) => r.id.length));
    const nameW = Math.max(
      8,
      ...rows.map((r: any) => r.username.length)
    );
    console.log(
      `${"TOKEN".padEnd(idW)}  ${"USERNAME".padEnd(nameW)}  STATUS       EXPIRES`
    );
    for (const r of rows) {
      const status = r.used_by
        ? "used"
        : new Date(r.expires_at) < new Date()
          ? "expired"
          : "pending";
      console.log(
        `${r.id.padEnd(idW)}  ${r.username.padEnd(nameW)}  ${status.padEnd(11)}  ${r.expires_at}`
      );
    }
  });

invite
  .command("delete")
  .description("Delete an invite token")
  .argument("<id>", "Invite token ID")
  .action(async (id: string) => {
    await api("DELETE", `/invites/${id}`);
    console.log(`Deleted invite: ${id}`);
  });

// --- Run ---

// Show help and exit 0 when no subcommand is given
program.action(() => {
  program.help();
});

program.parse();
