---
name: dev-dashboard
description: >-
  Start the dev-dashboard web server and display the URL.
  Detects if the server is already running, finds an available port if needed.
  Use when the user wants to open, start, or launch the dev-dashboard.
allowed-tools: Bash(bash:*) Bash(curl:*)
---

## Start Dev Dashboard

Start the dev-dashboard server (or reuse an existing instance) and display the URL.

### Step 1: Locate the Dashboard

The dashboard lives at `tools/dev-dashboard/` relative to the plugin's installation directory.

Resolve the dashboard directory:

```bash
PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
```

Where `$0` is this skill's base directory. Use the skill-loading context to find the absolute path to this skill, then resolve `../../tools/dev-dashboard` from the plugin root.

**However**, since the plugin is installed in a cache directory that doesn't contain `tools/`, use this approach instead:

1. Find the plugin's source repo by reading the plugin metadata
2. The dashboard directory is **always** at the path shown in the start script's first argument

Use the `$SKILL_BASE` path (from the skill-loading context) to construct:

```
DASHBOARD_DIR = (two levels up from skill base) + /../../tools/dev-dashboard
```

That is: from `plugins/dev-workflow/skills/dev-dashboard/`, go up to `plugins/dev-workflow/`, then up to the repo root, then into `tools/dev-dashboard/`.

**Important**: The plugin may be running from a cache directory (e.g., `~/.claude/plugins/cache/...`). In that case, the `tools/` directory won't exist there. You need to find the **source repository** path. Check if `tools/dev-dashboard/dist/server/index.js` exists at the resolved path. If not, ask the user for the path to the dev-workflow repository.

### Step 2: Run the Start Script

Run the start script from this skill's `scripts/` directory:

```bash
bash "$SCRIPTS/start.sh" "$DASHBOARD_DIR"
```

Where `$SCRIPTS` is the absolute path to `scripts/` within this skill's directory.

### Step 3: Parse Output and Report

The script outputs one of:
- `running:<port>` — server was already running
- `started:<port>` — new server started
- `error:<message>` — something went wrong

**On success**, display:

```
Dev Dashboard is running at: http://localhost:<port>
```

If it was already running, add: "(existing instance)"

**On error**, show the error message and suggest checking `/tmp/dev-dashboard.log`.
