import type { Command } from "commander";
import path from "node:path";
import type { ApiOpts } from "../helpers.js";
import { api, prompt, discoverVolumes } from "../helpers.js";

export function registerVolumeCommands(program: Command, getOpts: () => ApiOpts): void {
  const callApi = (method: string, endpoint: string, body?: Record<string, unknown>) =>
    api(method, endpoint, getOpts, body);

  const volume = program.command("volume").description("Manage storage volumes");
  volume.action(() => volume.help());

  volume
    .command("list")
    .description("List all configured volumes")
    .action(async () => {
      const data = await callApi("GET", "/volumes");
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
        const data = await callApi("GET", "/volumes");
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

        await callApi("POST", "/volumes", {
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
      await callApi("POST", "/volumes", { id, label, path: resolved });
      console.log(`Added volume: ${id} (${label}) -> ${resolved}`);
      console.log("Restart the server to pick up changes.");
    });

  volume
    .command("remove")
    .description("Remove a volume")
    .argument("<id>", "Volume ID")
    .action(async (id: string) => {
      const data = await callApi("DELETE", `/volumes/${id}`);
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
      await callApi("PATCH", `/volumes/${id}/visibility`, { visibility });
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
      const data = await callApi("GET", `/volumes/${volumeId}/access`);
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
      await callApi("POST", `/volumes/${volumeId}/access`, { userId });
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
      await callApi("DELETE", `/volumes/${volumeId}/access/${userId}`);
      console.log(
        `Revoked access to volume '${volumeId}' for user '${userId}'.`
      );
    });
}
