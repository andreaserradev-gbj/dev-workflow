---
name: dev-dashboard
description: >-
  Start the dev-dashboard web server and display the URL.
  Detects if the server is already running, finds an available port if needed.
  Use when the user wants to open, start, or launch the dev-dashboard.
allowed-tools: Bash(bash:*)
---

## Start Dev Dashboard

Start the dev-dashboard server (or reuse an existing instance) and display the URL.

### Step 1: Run the Start Script

The start script auto-resolves the bundled server relative to its own location. No arguments needed.

```bash
bash "$SCRIPTS/start.sh"
```

Where `$SCRIPTS` is the absolute path to `scripts/` within this skill's directory. Use `$HOME` instead of literal home paths.

### Step 2: Parse Output and Report

The script outputs one of:
- `running:<port>` — server was already running
- `started:<port>` — new server started
- `error:<message>` — something went wrong

**On success**, display:

```
Dev Dashboard: http://localhost:<port>
```

If it was already running, add "(already running)".

**On error**, show the error message and suggest checking `/tmp/dev-dashboard.log`.
