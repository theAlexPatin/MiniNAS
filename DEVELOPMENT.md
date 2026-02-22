# MiniNAS Developer Guide

A personal NAS with passkey authentication, resumable uploads, WebDAV, and Tailscale integration.

## Project Overview

MiniNAS is a pnpm monorepo with two packages:

| Package | Stack | Purpose |
|---------|-------|---------|
| `packages/api` | Hono + SQLite + Commander | HTTP API, WebDAV server, and CLI |
| `packages/web` | Astro + React + Tailwind | Browser-based file manager UI |

Turbo orchestrates builds across both packages.

## Prerequisites

- **Node.js 22+**
- **pnpm 10+** (enforced via `packageManager` field)
- **ffmpeg** (optional, for video thumbnails)

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum, generate secrets:
#   SESSION_SECRET=$(openssl rand -hex 32)
#   CLI_SECRET=$(openssl rand -hex 32)

# Start both API and web in dev mode
pnpm dev
```

The API server runs on `http://localhost:3001` and the web UI on `http://localhost:4321`. The Astro dev server proxies `/api` requests to the API automatically.

Visit `http://localhost:4321` — the first visitor registers as admin via passkey.

## Repository Structure

```
.
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry — starts Hono + file indexer
│   │   │   ├── app.ts                # Route composition + middleware wiring
│   │   │   ├── cli.ts                # CLI entry — Commander setup
│   │   │   ├── config.ts             # Unified config from env/files
│   │   │   ├── public-share-server.ts
│   │   │   ├── db/
│   │   │   │   ├── index.ts          # SQLite init, WAL mode, migrations
│   │   │   │   └── schema.sql        # Table definitions
│   │   │   ├── routes/               # API endpoints
│   │   │   │   ├── auth.ts           # WebAuthn registration + login
│   │   │   │   ├── files.ts          # List, delete, move, mkdir
│   │   │   │   ├── download.ts       # Streaming file downloads
│   │   │   │   ├── upload.ts         # TUS resumable upload bridge
│   │   │   │   ├── volumes.ts        # Volume CRUD
│   │   │   │   ├── search.ts         # File search
│   │   │   │   ├── preview.ts        # Image/video previews
│   │   │   │   ├── share.ts          # Public share links (no auth)
│   │   │   │   ├── webdav.ts         # WebDAV (RFC 4918)
│   │   │   │   ├── webdav-tokens.ts  # WebDAV app-specific tokens
│   │   │   │   ├── admin.ts          # Admin management endpoints
│   │   │   │   ├── cli.ts            # CLI-facing management endpoints
│   │   │   │   └── management.ts     # Shared logic for admin + CLI routes
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT session verification
│   │   │   │   ├── admin.ts          # Role check (admin only)
│   │   │   │   ├── cli-auth.ts       # CLI_SECRET token check
│   │   │   │   ├── webdav-auth.ts    # Basic auth with WebDAV tokens
│   │   │   │   ├── cors.ts           # CORS origin validation
│   │   │   │   ├── rate-limit.ts     # Auth endpoint rate limiting
│   │   │   │   └── static.ts         # SPA static file serving
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── sessions.ts       # JWT creation/verification (jose)
│   │   │   │   ├── volumes.ts        # Volume DB operations
│   │   │   │   ├── filesystem.ts     # Path resolution + traversal prevention
│   │   │   │   ├── access.ts         # Volume access control
│   │   │   │   ├── audit-log.ts      # Event logging to disk
│   │   │   │   ├── indexer.ts        # File indexing with chokidar watchers
│   │   │   │   ├── invites.ts        # Invite token management
│   │   │   │   ├── share.ts          # Share link logic
│   │   │   │   ├── webdav-tokens.ts  # WebDAV token CRUD
│   │   │   │   └── thumbnails.ts     # Sharp/ffmpeg thumbnail generation
│   │   │   ├── lib/
│   │   │   │   ├── url.ts            # CORS origin checking (isAllowedOrigin)
│   │   │   │   └── webdav-xml.ts     # WebDAV XML response builder
│   │   │   ├── types/
│   │   │   │   └── api.ts            # Zod request schemas
│   │   │   └── cli/
│   │   │       ├── helpers.ts        # Config loading, prompts, shell utils
│   │   │       └── commands/         # CLI subcommands
│   │   │           ├── setup.ts      # Tailscale + HTTPS setup wizard
│   │   │           ├── server.ts     # Server lifecycle (start/uninstall)
│   │   │           ├── gateway.ts    # Tailscale Funnel config
│   │   │           ├── doctor.ts     # Diagnostic checks
│   │   │           ├── volume.ts     # Volume add/remove/list
│   │   │           ├── user.ts       # User list/delete
│   │   │           └── invite.ts     # Invite create/list/revoke
│   │   └── test/                     # Vitest test suites
│   │       ├── setup.ts              # In-memory DB + temp dirs
│   │       ├── routes/
│   │       └── services/
│   └── web/
│       ├── src/
│       │   ├── pages/                # Astro file-based routing
│       │   ├── components/           # React components (FileBrowser, etc.)
│       │   ├── hooks/                # React hooks (useFileManager)
│       │   ├── lib/                  # Client utilities (API client, passkeys)
│       │   └── layouts/
│       └── astro.config.mjs          # Dev proxy + SPA fallback
├── homebrew/                         # Homebrew formula
├── .github/workflows/
│   ├── test.yml                      # CI — runs vitest on push/PR to main
│   └── release.yml                   # Builds tarball on version tags
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

## Architecture

### Request Flow

```
Client Request
    │
    ├─ /api/v1/auth/*       → rate limiter → auth routes (WebAuthn)
    ├─ /api/v1/share/*      → share routes (no auth)
    ├─ /api/v1/files/*      → authMiddleware → file routes
    ├─ /api/v1/upload/*     → authMiddleware → TUS server bridge
    ├─ /api/v1/volumes/*    → authMiddleware → volume routes
    ├─ /api/v1/search/*     → authMiddleware → search routes
    ├─ /api/v1/preview/*    → authMiddleware → preview routes
    ├─ /api/v1/admin/*      → authMiddleware → adminMiddleware → admin routes
    ├─ /api/v1/cli/*        → cliAuthMiddleware (X-CLI-Token) → CLI routes
    ├─ /dav/*               → webdavAuthMiddleware (Basic) → WebDAV
    └─ /*                   → static middleware (SPA fallback, prod only)
```

### Middleware Composition

Route protection is done via Hono sub-apps. The `withAuth()` helper in `app.ts` wraps route groups:

```typescript
function withAuth(routes: Hono): Hono {
  const h = new Hono();
  h.use("*", authMiddleware);
  h.route("/", routes);
  return h;
}
app.route("/api/v1/files", withAuth(filesRoutes));
```

Admin routes stack two middleware layers: `authMiddleware` then `adminMiddleware`.

### Authentication

MiniNAS uses **WebAuthn/passkeys** exclusively — there are no passwords.

**Setup flow:** The first visitor registers as admin. The server checks `hasUsersWithCredentials()` — if no user has a credential, it enters setup mode.

**Login flow:**
1. Browser requests authentication options (available credentials)
2. User authenticates with their passkey
3. Server verifies the signature, creates a JWT session
4. JWT is stored in an HttpOnly cookie + recorded in the `sessions` table

**Sessions:** HS256 JWTs with `{ sub: userId, jti: sessionId }`, 7-day expiry. Both the JWT and a corresponding DB record must exist for a session to be valid.

**WebAuthn RP (Relying Party):** `RP_ID` and `RP_ORIGIN` are auto-derived from `BASE_URL` when not explicitly set. This matters because passkeys are bound to the RP_ID hostname — if the hostname changes, existing passkeys stop working (see `mininas doctor`).

### Config Loading

Config comes from three sources, in priority order (highest wins):

1. **Real environment variables** (e.g., set by the shell or systemd)
2. **`.env` file** at the project root
3. **`~/.mininas/config.json`** (written by `mininas setup`)

The `loadConfigIntoEnv()` function in `cli/helpers.ts` merges sources 2 and 3, then sets `process.env` for any key not already present. Both `config.ts` (server) and `cli.ts` (CLI) call this at startup.

The `config` object in `config.ts` reads from `process.env` and provides typed, normalized values to the rest of the app.

### Database

SQLite via `better-sqlite3` with WAL mode for concurrent reads. Schema is in `src/db/schema.sql`.

**Tables:** `users`, `credentials`, `sessions`, `challenges`, `file_index`, `volumes`, `share_links`, `volume_access`, `invite_tokens`, `webdav_tokens`

Column migrations are handled inline in `db/index.ts` via `ALTER TABLE ADD COLUMN` wrapped in try-catch (idempotent on subsequent runs).

### File Indexing

On server startup, `scanVolume()` recursively indexes each volume into the `file_index` table. `chokidar` watchers then keep the index updated in real-time. Indexing runs in the background (1-second delay after startup) so it doesn't block the server.

### Upload Flow

Uses the **TUS protocol** for resumable uploads:

1. Client sends TUS metadata: `{ volume, filename, directory, relativePath }`
2. Server validates volume access before upload starts
3. `@tus/file-store` stages files in `UPLOAD_STAGING_DIR`
4. The `onUploadFinish` callback moves the file to its final location
5. Audit log records the event

Note: TUS runs as a separate HTTP handler that bypasses Hono middleware, so CORS headers are set manually in the upload route using `isAllowedOrigin()`.

### WebDAV

A full WebDAV (RFC 4918) implementation supporting: OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH. Authentication uses Basic Auth with app-specific tokens (managed via the web UI or API).

The lock store is in-memory — locks don't survive server restarts, which is fine for the single-user/small-team use case.

### Public Share Server

When `PUBLIC_SHARE_PORT` is set, a second Hono server runs on that port serving only share link endpoints. This is designed for use with Tailscale Funnel, which can expose a specific port to the public internet.

## Development Workflow

### Running in Dev Mode

```bash
pnpm dev       # Starts both API (port 3001) and Web (port 4321) with hot reload
```

The API uses `tsx watch` for TypeScript execution with file watching. The web UI uses Astro's dev server, which proxies API calls to port 3001.

### Building

```bash
pnpm build     # Builds both packages via Turbo
```

- **API:** `tsup` bundles `src/index.ts` and `src/cli.ts` as ESM, copies `schema.sql` to dist
- **Web:** Astro builds to static HTML/CSS/JS

### Testing

```bash
pnpm test                          # Run all tests via Turbo
cd packages/api && pnpm test       # Run API tests directly
```

Tests use Vitest with `pool: "forks"` (required for `better-sqlite3` native module). The test setup (`test/setup.ts`) configures an in-memory SQLite database and temp directories so tests don't touch real data.

To add a new test:
1. Create a file in `packages/api/test/routes/` or `test/services/`
2. Import from source — modules auto-initialize against the in-memory DB
3. Tests run with `vitest run` (no watch mode in CI)

### CLI Development

The CLI binary is `packages/api/dist/cli.js`. After building:

```bash
pnpm mininas --help                # Run via root package.json alias
pnpm mn volume list --token xxx    # Short alias
node packages/api/dist/cli.js ...  # Direct invocation
```

CLI commands that manage data (volume, user, invite) call the API over HTTP and require `--token` (or `CLI_SECRET` env var). Commands like `setup`, `doctor`, and `server` access the DB and config files directly and don't need a running server.

### Adding a New API Route

1. Create `packages/api/src/routes/my-feature.ts`:
   ```typescript
   import { Hono } from "hono";
   const app = new Hono();
   app.get("/", (c) => c.json({ hello: "world" }));
   export default app;
   ```

2. Wire it into `app.ts`:
   ```typescript
   import myFeatureRoutes from "./routes/my-feature.js";
   app.route("/api/v1/my-feature", withAuth(myFeatureRoutes));
   ```

3. Add a test in `test/routes/my-feature.test.ts`

### Adding a New CLI Command

1. Create `packages/api/src/cli/commands/my-cmd.ts`:
   ```typescript
   import type { Command } from "commander";
   import type { ApiOpts } from "../helpers.js";

   export function registerMyCommand(
     program: Command,
     getOpts: () => ApiOpts,
   ) {
     program
       .command("my-cmd")
       .description("Does something useful")
       .action(async () => {
         const { url, token } = getOpts();
         // ...
       });
   }
   ```

2. Register it in `cli.ts`:
   ```typescript
   import { registerMyCommand } from "./cli/commands/my-cmd.js";
   registerMyCommand(program, getOpts);
   ```

3. Add the entry to the `tsup` build if it's a separate entry point (usually not needed — cli.ts is already an entry point that imports subcommands).

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `SESSION_SECRET` | `change-me` | JWT signing secret (generate with `openssl rand -hex 32`) |
| `CLI_SECRET` | (none) | Token for CLI-to-API authentication |
| `BASE_URL` | (none) | External URL (e.g., `https://nas.tail1234.ts.net`). Auto-derives RP_ID/RP_ORIGIN. |
| `BASE_PATH` | (none) | Sub-path prefix (e.g., `/mininas`). All routes served under this path. |
| `RP_ID` | auto from BASE_URL or `localhost` | WebAuthn Relying Party ID (hostname) |
| `RP_NAME` | `MiniNAS` | WebAuthn Relying Party display name |
| `RP_ORIGIN` | auto from BASE_URL or `http://localhost:4321` | WebAuthn Relying Party origin |
| `PUBLIC_SHARE_PORT` | `0` (disabled) | Port for the public share server (Tailscale Funnel) |
| `PUBLIC_SHARE_URL` | (none) | External URL for share links |
| `DB_PATH` | `~/.mininas/data/mininas.db` | SQLite database location |
| `THUMBNAIL_DIR` | `~/.mininas/data/thumbnails` | Thumbnail cache directory |
| `UPLOAD_STAGING_DIR` | `~/.mininas/data/uploads` | TUS upload staging area |
| `AUDIT_LOG_DIR` | `~/.mininas/logs/audit` | Audit log directory |
| `WEB_DIST_DIR` | (none) | Path to built web assets (production single-process mode) |
| `MININAS_VERSION` | `dev` | Version string shown in UI |

## Database Schema

10 tables — see `packages/api/src/db/schema.sql` for full DDL.

Key relationships:
- `users` 1→N `credentials` (passkeys)
- `users` 1→N `sessions` (active JWTs)
- `users` N→N `volumes` (via `volume_access`)
- `users` 1→N `share_links`
- `users` 1→N `invite_tokens` (created_by)
- `users` 1→N `webdav_tokens`

## CI/CD

**Tests** (`.github/workflows/test.yml`): Runs on every push to `main` and on PRs. Uses Node 22 + pnpm with `--frozen-lockfile`.

**Releases** (`.github/workflows/release.yml`): Triggered by version tags (`v*`). Creates a GitHub Release with a source tarball.

**Homebrew**: The formula in `homebrew/Formula/mininas.rb` installs MiniNAS as a macOS service. After `brew install`, run `mininas setup` for the interactive Tailscale + HTTPS configuration wizard.

## Troubleshooting

**`mininas doctor`** diagnoses common issues without needing the server running:
- Database accessibility
- Session secret configuration
- Tailscale connection status
- Hostname mismatches (broken passkeys after Tailscale rename)
- Missing volume paths
- Server reachability

Run `mininas doctor` after any Tailscale hostname changes — it can update config and clear stale passkeys automatically.

**Pre-existing type errors**: The codebase has a few known TypeScript strictness issues (`c.env` typing in upload.ts, `unknown` error types). These don't affect runtime behavior and are tracked for future cleanup.

**Native module issues**: `better-sqlite3` and `sharp` are native modules. If you see build errors, ensure you have the correct Node.js version and platform-specific build tools (`xcode-select --install` on macOS).
