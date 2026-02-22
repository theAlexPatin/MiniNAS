<p align="center">
  <img src="logo.png" width="256" alt="MiniNAS">
</p>

<p align="center">
  Turn any Mac into a personal cloud storage server.<br>
  Browse, upload, preview, and share files from any device — no subscriptions, no third parties.
</p>

<p align="center">
  <a href="#installation">Install</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#managing">Managing</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
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

## Installation

### Homebrew (recommended)

```bash
brew tap theAlexPatin/mininas
brew install mininas
```

### Setup

MiniNAS uses [Tailscale](https://tailscale.com) for secure remote access. The setup wizard will walk you through it:

```bash
mininas setup
```

This will:
1. Check your Tailscale connection
2. Configure HTTPS certificates
3. Generate secrets and pick random ports
4. Set up Tailscale Serve for HTTPS access

### Start the server

```bash
brew services start mininas
```

Then open the URL shown during setup to register your passkey and start using MiniNAS.

### Add volumes

```bash
# Interactive — discovers mounted drives
mininas volume add

# Explicit
mininas volume add ssd1 "SSD 1" /Volumes/SSD1
```

## Managing

### Start / Stop

```bash
brew services start mininas     # Start the server
brew services stop mininas      # Stop the server
brew services restart mininas   # Restart the server
```

### Update

```bash
brew upgrade mininas
brew services restart mininas
```

Or trigger an update from the web UI: Settings > Software Update > Update & Restart.

### Reset

Wipe all data and re-run setup (your files on mounted volumes are not affected):

```bash
mininas start-fresh
```

### Uninstall

```bash
mininas uninstall               # Remove all data (~/.mininas/)
brew uninstall mininas          # Remove the application
```

### CLI Reference

```bash
mininas setup                              # Interactive guided setup
mininas server                             # Start the server (used by brew services)
mininas gateway                            # Show Tailscale gateway status

mininas volume list                        # List all volumes
mininas volume add                         # Interactive volume setup
mininas volume add <id> <label> <path>     # Add a volume explicitly
mininas volume remove <id>                 # Remove a volume
mininas volume visibility <id> public|private

mininas user list                          # List registered users
mininas user delete <id>                   # Delete a user

mininas invite create <username>           # Create an invite token
mininas invite list                        # List invites
mininas invite delete <id>                 # Delete an invite

mininas start-fresh                        # Wipe data and re-run setup
mininas uninstall                          # Remove all MiniNAS data
```

## Configuration

Configuration is stored in `~/.mininas/config.json` and is auto-generated by `mininas setup`. You can also set environment variables or use a `.env` file in the project root for development.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | auto | API server port (random high port) |
| `SESSION_SECRET` | auto | Secret for signing session tokens |
| `CLI_SECRET` | auto | Secret for authenticating CLI commands |
| `BASE_URL` | — | Tailscale HTTPS URL |
| `RP_ID` | derived | WebAuthn Relying Party ID (derived from BASE_URL) |
| `RP_ORIGIN` | derived | Frontend URL for WebAuthn verification |
| `DB_PATH` | `~/.mininas/data/mininas.db` | SQLite database location |
| `THUMBNAIL_DIR` | `~/.mininas/data/thumbnails` | Where generated thumbnails are cached |
| `UPLOAD_STAGING_DIR` | `~/.mininas/data/uploads` | Temporary directory for in-progress uploads |
| `WEB_DIST_DIR` | — | Path to built web assets (set by Homebrew) |
| `MININAS_VERSION` | `dev` | Version string (set by Homebrew) |

## Development

```bash
git clone https://github.com/theAlexPatin/MiniNAS.git
cd MiniNAS
pnpm install
cp .env.example .env
# Generate secrets: openssl rand -hex 32 → SESSION_SECRET and CLI_SECRET
pnpm dev
```

This starts the API (port 3001) and web UI (port 4321). Open **http://localhost:4321** to register as admin.

Requires **Node.js 22+** and **pnpm**. See **[DEVELOPMENT.md](DEVELOPMENT.md)** for architecture docs, testing, and contribution guidelines.

---

<p align="center">
  Built for personal use. No telemetry, no analytics, no cloud dependencies.<br>
  Your files, your hardware, your rules.
</p>
