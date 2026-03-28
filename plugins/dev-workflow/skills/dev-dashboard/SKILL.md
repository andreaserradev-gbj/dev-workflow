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
On first run, install or refresh the local `dev-dashboard` and `dev-dashboard-stop`
commands before launching so the skill and terminal path share the same bundled
launcher.

### Step 1: Check Install State

Run the install check first:

```bash
bash "$SCRIPTS/check-install.sh"
```

Where `$SCRIPTS` is the absolute path to `scripts/` within this skill's directory. Use `$HOME` instead of literal home paths.

Parse these output lines:
- `status:<installed|missing|stale>`
- `bin_dir:<path>`
- `on_path:<true|false>`
- `start_shim:<path>`
- `stop_shim:<path>`
- `error:<message>`

If the check emits `error:<message>`, stop and report the error.

### Step 2: Install When Needed

If `status` is `missing` or `stale`, run:

```bash
bash "$SCRIPTS/install.sh"
```

Parse these output lines:
- `installed:<bin-dir>`
- `path_warning:<bin-dir>`
- `error:<message>`

If install emits `error:<message>`, stop and report the error.

Treat install as explicit one-time onboarding:
- Tell the user local dashboard commands were installed or refreshed
- Mention `dev-dashboard` and `dev-dashboard-stop` are now the normal terminal commands
- If `path_warning:<bin-dir>` appears, note that the install succeeded but that directory is not currently on `PATH`

After install, run `bash "$SCRIPTS/check-install.sh"` again and use the returned `start_shim`
path for launch. If the re-check does not return `status:installed`, stop and report an error.

### Step 3: Launch Through the Installed Command

Always launch through the installed start shim returned by the install check so `/dev-dashboard`
and terminal usage go through the same entrypoint:

```bash
"$START_SHIM"
```

Use the absolute shim path from `start_shim:<path>`. Do not fall back to `bash "$SCRIPTS/start.sh"`
except when debugging the skill itself.

### Step 4: Parse Output and Report

The launch command outputs one of:
- `running:<port>` — server was already running
- `started:<port>` — new server started
- `error:<message>` — something went wrong

**On success**, display:

```
Dev Dashboard: http://localhost:<port>
```

If it was already running, add "(already running)".
If onboarding ran first, mention that setup completed before launch.

**On error**, show the error message.
If the error came from the launch command, suggest checking `/tmp/dev-dashboard.log`.
