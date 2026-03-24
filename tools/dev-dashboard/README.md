# Dev Dashboard

Live, cross-project dashboard that scans `.dev/` folders across your codebase and shows feature status in the browser with real-time updates.

<img src="../../docs/dashboard-preview.png" alt="Dev Dashboard" width="720"/>

## Usage

### Via Plugin Skill (recommended)

```
/dev-dashboard
```

Starts the server (or reuses an existing instance), finds an available port, and displays the URL. The server is bundled with the plugin — no build step or `npm install` needed. Only requires Node.js 24+.

### Manual (for development)

```bash
cd tools/dev-dashboard
npm install
npm run dev    # hot reload (Vite + tsx watch)
npm start      # production mode
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

## How It Works

1. Scans `scanDirs` for projects containing `.dev/` folders
2. Parses PRD markdown files (`00-master-plan.md`, sub-PRDs) and `checkpoint.md` for each feature
3. Derives feature status from PRD progress and checkpoint dates
4. Serves a Preact frontend over Fastify with WebSocket push updates
5. Watches for file changes and pushes live updates to all connected browsers

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

## Bundling

The dashboard is bundled with esbuild for zero-install distribution. After modifying source code:

```bash
npm run bundle
```

This builds the Vite client and esbuild-bundles the server into `plugins/dev-workflow/skills/dev-dashboard/dashboard/`. The bundle is a committed build artifact — stage it alongside source changes. The pre-commit hook blocks commits that change source without updating the bundle.

## Dev Dashboard vs Dev Board

| | Dev Dashboard | Dev Board |
|---|---|---|
| **Type** | Live web app | Static HTML file |
| **Use case** | Day-to-day development | Sharing with stakeholders |
| **Updates** | Real-time via WebSocket | Regenerate with `/dev-board` |
| **Scope** | Cross-project (multiple repos) | Single project |
