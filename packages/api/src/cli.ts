#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigIntoEnv } from "./cli/helpers.js";
import { registerVolumeCommands } from "./cli/commands/volume.js";
import { registerUserCommands } from "./cli/commands/user.js";
import { registerInviteCommands } from "./cli/commands/invite.js";
import { registerSetupCommand } from "./cli/commands/setup.js";
import { registerGatewayCommand } from "./cli/commands/gateway.js";
import { registerDoctorCommand } from "./cli/commands/doctor.js";
import { registerServerCommands } from "./cli/commands/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load config: .env overrides ~/.mininas/config.json, real env vars override both.
const envPath = path.resolve(__dirname, "../../../.env");
loadConfigIntoEnv(envPath);

// --- Commander setup ---

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

function getOpts() {
  const opts = program.opts();
  if (!opts.token) {
    console.error(
      "Error: CLI_SECRET not set. Pass --token or set CLI_SECRET env var."
    );
    process.exit(1);
  }
  return { url: opts.url as string, token: opts.token as string };
}

// --- Register all commands ---

registerVolumeCommands(program, getOpts);
registerUserCommands(program, getOpts);
registerInviteCommands(program, getOpts);
registerSetupCommand(program, envPath);
registerGatewayCommand(program, envPath);
registerDoctorCommand(program, envPath);
registerServerCommands(program, envPath, __dirname);

// Show help and exit 0 when no subcommand is given
program.action(() => {
  program.help();
});

program.parse();
