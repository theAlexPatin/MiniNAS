import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

// Config paths
export const configDir = path.join(os.homedir(), ".mininas");
export const configPath = path.join(configDir, "config.json");

// --- HTTP helpers ---

export interface ApiOpts {
  url: string;
  token: string;
}

export async function api(
  method: string,
  endpoint: string,
  getOpts: () => ApiOpts,
  body?: Record<string, unknown>,
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

export function prompt(question: string): Promise<string> {
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

export function waitForEnter(message: string): Promise<void> {
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

// --- Shell / config helpers ---

export function exec(cmd: string): { ok: boolean; stdout: string; stderr: string } {
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

export function readConfigFile(): Record<string, string> {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

export function writeConfigFile(vars: Record<string, string>): void {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(vars, null, 2) + "\n", "utf-8");
}

export function readEnvFile(envPath: string): Record<string, string> {
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
export function readMergedConfig(envPath: string): Record<string, string> {
  return { ...readConfigFile(), ...readEnvFile(envPath) };
}

/** Load merged config into process.env (real env vars take priority) */
export function loadConfigIntoEnv(envPath: string): void {
  const merged = readMergedConfig(envPath);
  for (const [key, value] of Object.entries(merged)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

// --- Port helpers ---

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findAvailablePort(preferred?: number): Promise<number> {
  if (preferred && await isPortAvailable(preferred)) return preferred;
  // IANA dynamic/private port range
  for (let i = 0; i < 20; i++) {
    const port = 49152 + Math.floor(Math.random() * (65535 - 49152));
    if (await isPortAvailable(port)) return port;
  }
  throw new Error("Could not find an available port");
}

// --- Volume discovery (local) ---

export function discoverVolumes(): { name: string; path: string }[] {
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

// --- Database helpers (direct SQLite access, no server needed) ---

export async function checkHasAdminUser(): Promise<boolean> {
  const dbPath = path.join(configDir, "data", "mininas.db");
  if (!fs.existsSync(dbPath)) return false;
  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM users u JOIN credentials c ON c.user_id = u.id"
    ).get() as { count: number } | undefined;
    db.close();
    return (row?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
