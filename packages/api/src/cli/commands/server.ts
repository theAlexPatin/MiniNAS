import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { configDir, configPath, exec, prompt } from "../helpers.js";
import { runSetup } from "./setup.js";

export function registerServerCommands(program: Command, envPath: string, __dirname: string): void {
  program
    .command("server")
    .description("Start the MiniNAS server (used by brew services)")
    .action(async () => {
      const serverPath = path.join(__dirname, "index.js");
      if (!fs.existsSync(serverPath)) {
        console.error(`Server file not found: ${serverPath}`);
        console.error("Run 'pnpm build' first or install via Homebrew.");
        process.exit(1);
      }

      console.log("Starting MiniNAS server...");
      const { fork } = await import("node:child_process");
      const child = fork(serverPath, [], {
        stdio: "inherit",
        env: { ...process.env },
      });

      child.on("exit", (code) => {
        process.exit(code ?? 1);
      });

      // Forward signals to child
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, () => {
          child.kill(signal);
        });
      }
    });

  // --- Start-fresh command ---

  program
    .command("start-fresh")
    .description("Wipe all data and re-run setup")
    .action(async () => {
      console.log("\n  This will delete ALL MiniNAS data including:");
      console.log("    - Database (users, volumes, settings)");
      console.log("    - Thumbnails and upload staging");
      console.log("    - Logs");
      console.log("    - Configuration\n");
      console.log("  Your actual files on mounted volumes will NOT be deleted.\n");

      const answer = await prompt("  Type 'yes' to confirm: ");
      if (answer !== "yes") {
        console.log("  Aborted.");
        return;
      }

      // Stop running server if detected
      console.log("\nStopping MiniNAS service...");
      exec("brew services stop mininas");

      // Remove data directories
      const dataDir = path.join(configDir, "data");
      const logsDir = path.join(configDir, "logs");

      for (const dir of [dataDir, logsDir]) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`  Removed ${dir}`);
        }
      }

      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log(`  Removed ${configPath}`);
      }

      console.log();

      // Re-run setup
      await runSetup(envPath);
    });

  // --- Uninstall command ---

  program
    .command("uninstall")
    .description("Remove all MiniNAS data and configuration")
    .action(async () => {
      console.log("\n  This will permanently delete ALL MiniNAS data:");
      console.log(`    ${configDir}/`);
      console.log("\n  Your actual files on mounted volumes will NOT be deleted.\n");

      const answer = await prompt("  Type 'yes' to confirm: ");
      if (answer !== "yes") {
        console.log("  Aborted.");
        return;
      }

      // Stop running server
      console.log("\nStopping MiniNAS service...");
      exec("brew services stop mininas");

      // Reset Tailscale Serve
      console.log("Resetting Tailscale Serve...");
      exec("tailscale serve reset");

      // Remove all data
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
        console.log(`Removed ${configDir}/`);
      }

      console.log(`
  MiniNAS data has been removed.
  To also remove the application: brew uninstall mininas
`);
    });
}
