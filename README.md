<p align="center">
  <img src="logo.png" width="256" alt="MiniNAS">
</p>

<p align="center">
  Turn any Mac into a personal cloud storage server.<br>
  Browse, upload, preview, and share files from any device — no subscriptions, no third parties.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#access-from-anywhere">Remote Access</a> &bull;
  <a href="#development">Development</a>
</p>

---

## Why MiniNAS?

You already own the hardware. A Mac Mini with a couple of USB SSDs is more storage than most cloud plans offer — and it's yours. MiniNAS gives you a clean web interface to manage it all, accessible from your phone, tablet, or any browser.

- **No monthly fees.** Your data lives on your drives, not someone else's servers.
- **No file size limits.** Upload anything — resumable uploads handle multi-gigabyte files without breaking a sweat.
- **No apps to install.** It's a web app. Works on macOS, iOS, Android, Windows — any device with a browser.
- **No passwords to remember.** Sign in with Touch ID, Face ID, or your device's biometrics via Passkeys.

## Features

**File Management**
- Browse files across multiple USB drives from a single interface
- List and grid views with file-type icons
- Create folders, rename, move, and delete
- Breadcrumb navigation with full path history

**Uploads**
- Drag-and-drop files or entire folders
- Resumable uploads — pause, resume, or recover from network interruptions
- Per-file progress tracking with cancel support
- No file size limits

**Preview & Search**
- Inline preview for images, video, audio, PDFs, and text files
- Auto-generated thumbnails for images and video
- Search files by name across all your drives instantly

**Sharing**
- Generate share links for any file
- Optional password protection
- Set expiration times and download limits
- Share links work without requiring the recipient to log in

**Security**
- Passkey authentication (WebAuthn) — no passwords, just biometrics
- All API routes are session-protected
- Path traversal prevention on every file operation
- Rate limiting on authentication endpoints

**WebDAV**
- Mount volumes as network drives on any OS
- App-specific tokens for secure access (no session cookies)
- Works with macOS Finder, Windows Explorer, and Linux file managers

**Works Everywhere**
- Installable as a PWA on iOS and Android home screens
- Designed for mobile and desktop
- Dark interface that looks great on any screen size

## Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm**
- **ffmpeg** (optional, for video thumbnails): `brew install ffmpeg`

### Install

```bash
git clone https://github.com/theAlexPatin/MiniNAS.git
cd MiniNAS
pnpm install
```

### Configure

Copy the example config and generate your secrets:

```bash
cp .env.example .env

# Generate secrets (paste the output into .env)
openssl rand -hex 32  # → SESSION_SECRET
openssl rand -hex 32  # → CLI_SECRET
```

At minimum, set `SESSION_SECRET` and `CLI_SECRET` in your `.env`. Volumes can be added later via the CLI.

### Run

```bash
pnpm dev
```

This starts both the API server (port 3001) and the web frontend (port 4321). Open **http://localhost:4321** in your browser.

On first visit, you'll be prompted to register a Passkey — this is your login credential going forward. No username or password needed.

### Add Volumes

Once the server is running, add your drives via the CLI:

```bash
# Interactive — discovers mounted volumes in /Volumes
pnpm mininas volume add

# Explicit
pnpm mininas volume add ssd1 "SSD 1" /Volumes/SSD1
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `SESSION_SECRET` | — | Secret for signing session tokens (generate with `openssl rand -hex 32`) |
| `CLI_SECRET` | — | Secret for authenticating CLI commands (generate with `openssl rand -hex 32`) |
| `RP_ID` | `localhost` | WebAuthn Relying Party ID (your domain or `localhost`) |
| `RP_ORIGIN` | `http://localhost:4321` | Frontend URL for WebAuthn verification |
| `DB_PATH` | `~/.mininas/data/mininas.db` | SQLite database location |
| `THUMBNAIL_DIR` | `~/.mininas/data/thumbnails` | Where generated thumbnails are cached |
| `UPLOAD_STAGING_DIR` | `~/.mininas/data/uploads` | Temporary directory for in-progress uploads |

## Access from Anywhere

MiniNAS is designed to pair with [Tailscale](https://tailscale.com) for secure remote access. Install Tailscale on your Mac Mini and your devices, then:

1. Set `RP_ID` to your Tailscale hostname (e.g., `mac-mini.tailnet.ts.net`)
2. Set `RP_ORIGIN` to `https://mac-mini.tailnet.ts.net:4321`
3. Enable [Tailscale HTTPS](https://tailscale.com/kb/1153/enabling-https) for valid certificates

Your NAS is now securely accessible from anywhere in the world — no port forwarding, no dynamic DNS, no exposed services.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | [Hono](https://hono.dev) + Node.js |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Auth | [WebAuthn/Passkeys](https://simplewebauthn.dev) + JWT sessions |
| Uploads | [tus protocol](https://tus.io) for resumable uploads |
| Thumbnails | [sharp](https://sharp.pixelplumbing.com) (images) + ffmpeg (video) |
| Frontend | [Astro](https://astro.build) + React + [Tailwind CSS](https://tailwindcss.com) |
| Data Fetching | [TanStack Query](https://tanstack.com/query) |

---

## Development

MiniNAS is a pnpm monorepo managed with [Turborepo](https://turbo.build).

```
packages/
  api/     # Hono REST API server
  web/     # Astro + React frontend
```

### Commands

```bash
pnpm dev          # Start both API and frontend in dev mode
pnpm build        # Build everything for production

# Run packages individually
pnpm --filter @mininas/api dev
pnpm --filter @mininas/web dev
```

### CLI

MiniNAS includes a CLI for managing volumes, users, and invites. The CLI authenticates against the running API server using `CLI_SECRET`.

```bash
pnpm mininas volume list                  # List all volumes
pnpm mininas volume add                   # Interactive volume setup
pnpm mininas volume remove <id>           # Remove a volume
pnpm mininas volume visibility <id> public|private

pnpm mininas user list                    # List registered users
pnpm mininas user delete <id>             # Delete a user

pnpm mininas invite create <username>     # Create an invite token
pnpm mininas invite list                  # List invites
pnpm mininas invite delete <id>           # Delete an invite
```

The CLI reads `CLI_SECRET` from `.env` automatically. You can also pass `--token <secret>` or `--url <api-url>` to override.

### API Structure

```
packages/api/src/
  cli.ts         # CLI entry point (volume, user, invite management)
  routes/        # Hono route handlers (files, download, upload, auth, search, share, preview, volumes, webdav, cli)
  services/      # Business logic (filesystem, sessions, indexer, thumbnails, share)
  middleware/    # Auth verification, CORS, rate limiting
  db/            # SQLite connection + schema
  types/         # Zod schemas for request/response validation
```

### WebDAV

MiniNAS exposes a WebDAV endpoint at `/dav/` for mounting volumes as network drives. Users can generate app-specific tokens from the web UI under account settings, then connect using their OS's built-in network drive support with Basic Auth (username + app token).

---

<p align="center">
  Built for personal use. No telemetry, no analytics, no cloud dependencies.<br>
  Your files, your hardware, your rules.
</p>
