import type { Command } from "commander";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import {
  configPath,
  exec,
  waitForEnter,
  readMergedConfig,
  readConfigFile,
  writeConfigFile,
  findAvailablePort,
  checkHasAdminUser,
} from "../helpers.js";

export async function runSetup(envPath: string): Promise<void> {
  console.log("\n  MiniNAS Setup\n");

  // 0. Check if admin user already exists
  if (await checkHasAdminUser()) {
    console.log("  An admin user is already registered.");
    console.log("  If you want to start over, run: mininas start-fresh");
    console.log("  To reconfigure Tailscale, the existing setup is preserved.\n");
    return;
  }

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
  const existing = readMergedConfig(envPath);
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

  cfg.PORT = existing.PORT || String(await findAvailablePort());
  cfg.RP_NAME = "MiniNAS";
  cfg.BASE_URL = `https://${hostname}`;
  cfg.PUBLIC_SHARE_PORT = existing.PUBLIC_SHARE_PORT || String(await findAvailablePort());
  cfg.PUBLIC_SHARE_URL = `https://${hostname}:8443`;

  // 7. Write config
  writeConfigFile(cfg);
  console.log(`  Written to ${configPath}`);

  // 8. Configure Tailscale Serve (single-process: API serves both API + web)
  console.log("\nConfiguring Tailscale Serve...");
  const servePort = cfg.PORT || "3001";
  const serveResult = exec(`tailscale serve --bg ${servePort}`);
  if (serveResult.ok) {
    console.log(`  Serve: https → localhost:${servePort}`);
  } else {
    console.log(`  Warning: Could not configure Tailscale Serve.`);
    console.log(`  ${serveResult.stderr}`);
  }

  // 9. Configure Tailscale Funnel
  console.log("Configuring Tailscale Funnel...");
  const sharePort = cfg.PUBLIC_SHARE_PORT || "3002";
  const funnelResult = exec(`tailscale funnel --bg --https=8443 ${sharePort}`);
  if (funnelResult.ok) {
    console.log(`  Funnel: :8443 → localhost:${sharePort}`);
  } else {
    console.log("  Warning: Could not configure Tailscale Funnel.");
    console.log(`  ${funnelResult.stderr}`);
  }

  // 10. Print summary
  const bp = existing.BASE_PATH || "";
  const setupUrl = `https://${hostname}${bp}/setup`;
  console.log(`
============================================================
  MiniNAS Setup Complete
============================================================

  Web App:    https://${hostname}${bp}
  WebDAV:     https://${hostname}${bp}/dav/
  Public:     https://${hostname}:8443

  Next steps:
    1. Start the server:   brew services start mininas
    2. Register passkey at ${setupUrl}
    3. Add volumes:        mininas volume add
`);

  // Open the setup page in the default browser
  const openCmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(openCmd, [setupUrl], { detached: true, stdio: "ignore" });
  child.unref();
}

export function registerSetupCommand(program: Command, envPath: string): void {
  program
    .command("setup")
    .description("Interactive guided setup for MiniNAS with Tailscale")
    .action(async () => {
      await runSetup(envPath);
    });
}
