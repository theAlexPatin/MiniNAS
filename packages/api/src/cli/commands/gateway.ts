import type { Command } from "commander";
import { exec, readMergedConfig } from "../helpers.js";

export function registerGatewayCommand(program: Command, envPath: string): void {
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
      const cfg = readMergedConfig(envPath);
      const sharePort = cfg.PUBLIC_SHARE_PORT || "3002";

      const apiPort = cfg.PORT || "3001";
      const gwBp = cfg.BASE_PATH || "";
      console.log();
      if (serveConfigured) {
        console.log(`  Web App:   https://${hostname}${gwBp}`);
        console.log(`             Tailscale Serve → localhost:${apiPort}`);
        console.log();
        console.log(`  WebDAV:    https://${hostname}${gwBp}/dav/`);
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
}
