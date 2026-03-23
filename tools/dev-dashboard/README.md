# Dev Dashboard

Live, cross-project dashboard that scans `.dev/` folders across your codebase and shows feature status in the browser with real-time updates.

## Quick Start

```bash
cd tools/dev-dashboard
npm install
npm start -- --scan ~/code
```

Open `http://localhost:3141` in your browser.

For development (with hot reload):

```bash
npm run dev
```

## Configuration

Config lives at `~/.config/dev-dashboard/config.json` (created automatically on first run):

```json
{
  "scanDirs": ["~/code"],
  "port": 3141,
  "notifications": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scanDirs` | `string[]` | `["~/code"]` | Directories to scan for projects containing `.dev/` folders. Supports `~` expansion. |
| `port` | `number` | `3141` | HTTP server port |
| `notifications` | `boolean` | `false` | Enable browser notifications on feature updates |

## CLI Flags

Flags override config file values:

```bash
npm start -- --scan ~/code ~/work --port 8080
```

| Flag | Description |
|------|-------------|
| `--scan <dir...>` | One or more directories to scan (overrides `scanDirs`) |
| `--port <number>` | Server port (overrides `port`) |

## Shell Alias

For quick access from anywhere:

```bash
alias dev-dashboard='bash /path/to/dev-workflow/tools/dev-dashboard/bin/dev-dashboard'
```

The `bin/dev-dashboard` script handles dependency installation and launches the server.

## How It Works

1. Scans `scanDirs` for projects containing `.dev/` folders
2. Parses PRD markdown files (`00-master-plan.md`, sub-PRDs) and `checkpoint.md` for each feature
3. Derives feature status from PRD progress and checkpoint dates
4. Serves a Preact frontend over Fastify with WebSocket push updates
5. Watches for file changes via chokidar and pushes live updates to all connected browsers

## Feature Statuses

| Status | Meaning |
|--------|---------|
| **Gate** | Phase complete, waiting for user decision to continue |
| **Active** | Has a PRD with recent activity (within 30 days) |
| **Checkpoint** | Has a checkpoint file but no PRD |
| **Stale** | No activity for 30+ days |
| **No PRD** | `.dev/` folder exists but no master plan |
| **Empty** | Empty `.dev/` directory |
| **Complete** | All PRD steps finished |

## Dev Dashboard vs Dev Board

| | Dev Dashboard | Dev Board |
|---|---|---|
| **Type** | Live web app | Static HTML file |
| **Use case** | Day-to-day development | Sharing with stakeholders |
| **Updates** | Real-time via WebSocket | Regenerate with `/dev-board` |
| **Scope** | Cross-project (multiple repos) | Single project |
