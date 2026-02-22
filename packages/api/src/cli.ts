#!/usr/bin/env node

import { Command } from "commander";
import crypto from "node:crypto";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config paths
const configDir = path.join(os.homedir(), ".mininas");
const configPath = path.join(configDir, "config.json");
const envPath = path.resolve(__dirname, "../../../.env");

// Load config: .env overrides ~/.mininas/config.json, real env vars override both.
// We merge into a single object (env wins over json), then set into process.env
// only where a real env var doesn't already exist.
{
  const configVars: Record<string, string> = {};
  const envVars: Record<string, string> = {};

  if (fs.existsSync(configPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") configVars[key] = value;
      }
    } catch {}
  }

  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      envVars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }

  const merged = { ...configVars, ...envVars };
  for (const [key, value] of Object.entries(merged)) {
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

// --- Shell / config helpers ---

function exec(cmd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (e: any) {
    return {
      ok: false,
      stdout: (e.stdout ?? "").toString().trim(),
      stderr: (e.stderr ?? "").toString().trim(),
    };
  }
}

function readConfigFile(): Record<string, string> {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfigFile(vars: Record<string, string>): void {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(vars, null, 2) + "\n", "utf-8");
}

function readEnvFile(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

/** Merged config: ~/.mininas/config.json base, .env overrides */
function readMergedConfig(): Record<string, string> {
  return { ...readConfigFile(), ...readEnvFile() };
}

function waitForEnter(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
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
  .command("reset-passkeys")
  .description("Remove all passkeys for a user (they can re-register on next login)")
  .argument("<id>", "User ID")
  .action(async (id: string) => {
    const data = await api("POST", `/users/${id}/reset-passkeys`);
    console.log(`Reset passkeys for '${data.username}' (removed ${data.removedCredentials} credential(s)).`);
    console.log("They will be prompted to register a new passkey on next login.");
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

// --- Setup command ---

async function runSetup(): Promise<void> {
  console.log("\n  MiniNAS Setup\n");

  // 1. Check Tailscale installed
  console.log("Checking Tailscale installation...");
  const tsVersion = exec("tailscale version");
  if (!tsVersion.ok) {
    console.error("Tailscale is not installed.");
    console.error("  macOS:   https://tailscale.com/download/mac");
    console.error("  Linux:   https://tailscale.com/download/linux");
    console.error("  Other:   https://tailscale.com/download");
    process.exit(1);
  }
  console.log(`  Tailscale ${tsVersion.stdout.split("\n")[0]}`);

  // 2. Check Tailscale connected
  console.log("\nChecking Tailscale connection...");
  let tsStatus = exec("tailscale status");
  if (!tsStatus.ok) {
    console.log("  Tailscale is not connected. Run 'tailscale up' to log in.");
    await waitForEnter("  Press Enter after connecting Tailscale... ");
    tsStatus = exec("tailscale status");
    if (!tsStatus.ok) {
      console.error("  Tailscale still not connected. Please run 'tailscale up' and try again.");
      process.exit(1);
    }
  }
  console.log("  Connected");

  // 3. Get hostname
  console.log("\nGetting Tailscale hostname...");
  const tsJson = exec("tailscale status --json");
  if (!tsJson.ok) {
    console.error("  Failed to get Tailscale status.");
    process.exit(1);
  }
  const tsInfo = JSON.parse(tsJson.stdout);
  const hostname = (tsInfo.Self?.DNSName ?? "").replace(/\.$/, "");
  if (!hostname) {
    console.error("  Could not determine Tailscale hostname.");
    process.exit(1);
  }
  console.log(`  Hostname: ${hostname}`);

  // 4. Ensure HTTPS certs
  console.log("\nChecking HTTPS certificates...");
  let certResult = exec(`tailscale cert ${hostname}`);
  if (!certResult.ok && certResult.stderr.includes("not enabled")) {
    console.log("  HTTPS certificates are not enabled on your tailnet.");
    console.log("  Enable them at: https://login.tailscale.com/admin/dns");
    console.log("  (Toggle 'Enable HTTPS Certificates')");
    await waitForEnter("  Press Enter after enabling HTTPS... ");
    certResult = exec(`tailscale cert ${hostname}`);
    if (!certResult.ok) {
      console.error("  Still unable to issue certificates. Please enable HTTPS and try again.");
      process.exit(1);
    }
  } else if (!certResult.ok) {
    console.error(`  Failed to issue certificate: ${certResult.stderr}`);
    process.exit(1);
  }
  // Clean up generated cert/key files
  try { fs.unlinkSync(`${hostname}.crt`); } catch {}
  try { fs.unlinkSync(`${hostname}.key`); } catch {}
  console.log("  HTTPS certificates OK");

  // 5. Ensure Funnel enabled
  console.log("\nChecking Tailscale Funnel...");
  const funnelStatus = exec("tailscale funnel status");
  if (!funnelStatus.ok) {
    console.log("  Tailscale Funnel is not enabled.");
    console.log("  Enable it at: https://login.tailscale.com/admin/acls");
    console.log("  (Add a funnel policy or enable via the admin console)");
    await waitForEnter("  Press Enter after enabling Funnel (or press Enter to skip)... ");
    const funnelRetry = exec("tailscale funnel status");
    if (!funnelRetry.ok) {
      console.log("  Warning: Funnel not available. Public sharing will not work.");
      console.log("  You can enable it later and re-run 'mininas setup'.");
    } else {
      console.log("  Funnel enabled");
    }
  } else {
    console.log("  Funnel enabled");
  }

  // 6. Build config vars
  console.log("\nConfiguring environment...");
  const existing = readMergedConfig();
  const cfg = readConfigFile();

  const placeholder = "change-me-to-a-random-string";

  // Preserve or generate secrets (check merged config for existing values)
  const existingSession = existing.SESSION_SECRET;
  if (!existingSession || existingSession === placeholder) {
    cfg.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  } else {
    cfg.SESSION_SECRET = existingSession;
  }
  const existingCli = existing.CLI_SECRET;
  if (!existingCli || existingCli === placeholder) {
    cfg.CLI_SECRET = crypto.randomBytes(32).toString("hex");
  } else {
    cfg.CLI_SECRET = existingCli;
  }

  cfg.PORT = existing.PORT || "3001";
  cfg.RP_NAME = "MiniNAS";
  cfg.BASE_URL = `https://${hostname}`;
  cfg.PUBLIC_SHARE_PORT = "3002";
  cfg.PUBLIC_SHARE_URL = `https://${hostname}:8443`;

  // 7. Write config
  writeConfigFile(cfg);
  console.log(`  Written to ${configPath}`);

  // 8. Configure Tailscale Serve
  console.log("\nConfiguring Tailscale Serve...");
  const serveResult = exec("tailscale serve --bg 4321");
  if (serveResult.ok) {
    console.log("  Serve: https → localhost:4321");
  } else {
    console.log(`  Warning: Could not configure Tailscale Serve.`);
    console.log(`  ${serveResult.stderr}`);
  }

  // 9. Configure Tailscale Funnel
  console.log("Configuring Tailscale Funnel...");
  const funnelResult = exec("tailscale funnel --bg --https=8443 3002");
  if (funnelResult.ok) {
    console.log("  Funnel: :8443 → localhost:3002");
  } else {
    console.log("  Warning: Could not configure Tailscale Funnel.");
    console.log(`  ${funnelResult.stderr}`);
  }

  // 10. Print summary
  const setupUrl = `https://${hostname}/setup`;
  console.log(`
============================================================
  MiniNAS Setup Complete
============================================================

  Web App:    https://${hostname}
  WebDAV:     https://${hostname}/dav/
  Public:     https://${hostname}:8443

  Next steps:
    1. Start the dev server:  pnpm dev
    2. Register your passkey at ${setupUrl}
    3. Add volumes:  pnpm mininas volume add
`);

  // Open the setup page in the default browser
  const openCmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(openCmd, [setupUrl], { detached: true, stdio: "ignore" });
  child.unref();
}

program
  .command("setup")
  .description("Interactive guided setup for MiniNAS with Tailscale")
  .action(async () => {
    await runSetup();
  });

// --- Gateway command ---

program
  .command("gateway")
  .description("Show current Tailscale gateway status and URLs")
  .action(async () => {
    // 1. Get hostname
    const tsJson = exec("tailscale status --json");
    if (!tsJson.ok) {
      console.error("Tailscale is not running or not installed.");
      console.error("Run 'mininas setup' to configure.");
      process.exit(1);
    }

    const tsInfo = JSON.parse(tsJson.stdout);
    const hostname = (tsInfo.Self?.DNSName ?? "").replace(/\.$/, "");
    if (!hostname) {
      console.error("Could not determine Tailscale hostname.");
      process.exit(1);
    }

    // 2. Check serve status
    const serveStatus = exec("tailscale serve status");
    const serveConfigured = serveStatus.ok && serveStatus.stdout.length > 0;

    // 3. Check funnel status
    const funnelStatus = exec("tailscale funnel status");
    const funnelConfigured = funnelStatus.ok && funnelStatus.stdout.length > 0;

    // 4. Read config for port info
    const cfg = readMergedConfig();
    const sharePort = cfg.PUBLIC_SHARE_PORT || "3002";

    console.log();
    if (serveConfigured) {
      console.log(`  Web App:   https://${hostname}`);
      console.log(`             Tailscale Serve → localhost:4321`);
      console.log();
      console.log(`  WebDAV:    https://${hostname}/dav/`);
      console.log(`             (same origin)`);
    } else {
      console.log("  Tailscale Serve: not configured");
    }

    console.log();
    if (funnelConfigured) {
      console.log(`  Public:    https://${hostname}:8443`);
      console.log(`             Tailscale Funnel → localhost:${sharePort}`);
    } else {
      console.log("  Tailscale Funnel: not configured");
    }

    if (!serveConfigured || !funnelConfigured) {
      console.log();
      console.log("  Run 'mininas setup' to configure.");
    }
    console.log();
  });

// --- Run ---

// Show help and exit 0 when no subcommand is given
program.action(() => {
  program.help();
});

program.parse();
