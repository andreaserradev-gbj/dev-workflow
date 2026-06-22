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
The dashboard runs entirely from the bundled launcher in this skill — there is **no
`~/.local/bin` install step** and no command shims to manage.

### Step 1: Launch

Run the bundled start script directly by absolute path:

```bash
bash "$SCRIPTS/start.sh" --open
```

Where `$SCRIPTS` is the absolute path to `scripts/` within this skill's directory. Use `$HOME` instead of literal home paths.

`start.sh` resolves the bundled server relative to its own location, reuses an
already-running instance if one is found (matched across plugin versions), or
starts a fresh one on the configured port (falling back to a nearby free port).
`--open` also opens the dashboard in the browser. The server binds to `127.0.0.1`
(localhost only) by default.

To stop the server, run the bundled stop script:

```bash
bash "$SCRIPTS/stop.sh"
```

### Step 2: Parse Output and Report

The launch command outputs one of:
- `running:<port>` — server was already running
- `started:<port>` — new server started
- `error:<message>` — something went wrong

**On success**, display:

```
Dev Dashboard: http://localhost:<port>
```

If it was already running, add "(already running)".

**On error**, show the error message.
If the error came from the launch command, suggest checking `/tmp/dev-dashboard.log`.
