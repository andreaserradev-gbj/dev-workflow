---
name: dev-dashboard-tui
description: >-
  Hand the user the command to launch the dev-dashboard TUI — a terminal-native,
  cross-project .dev/ feature portfolio (status, progress, detail panes) for
  SSH/tmux/no-browser workflows. Use when the user wants to open, start, or
  launch the terminal dashboard / dev-dashboard TUI. The agent cannot run it — a
  TUI needs an interactive terminal — so this skill prints the exact command to
  paste.
allowed-tools: Bash(test:*)
---

## Launch the Dev Dashboard TUI

The dev-dashboard TUI is the terminal-native sibling of the web `/dev-dashboard`:
the same cross-project `.dev/` feature portfolio — a recency-sorted project rail,
per-feature status and progress, and a detail pane — rendered natively in the
terminal for SSH/tmux/no-browser workflows. It live-refreshes as `.dev/` PRDs
change.

### Why the agent cannot start it

A TUI is a **foreground, interactive** process that must own a real terminal
(TTY). Claude Code's `Bash` tool runs commands against a detached, non-interactive
pipe — an Ink app rendered there produces garbage and never receives keystrokes.
Unlike `/dev-dashboard` (which backgrounds an HTTP server and reports a URL), this
skill **hands the launch command to the user** to run in their own terminal.

**Do not attempt to spawn the TUI from a `Bash` tool call.**

### Step 1: Resolve the launch command

The launcher lives at `scripts/launch.sh` within this skill's directory. Build the
absolute path to it (call it `$LAUNCH`). Optionally confirm the bundled artifact
is present first:

```bash
test -f "$LAUNCH" && echo ok
```

Where `$LAUNCH` is the absolute path to `scripts/launch.sh` within this skill's
directory. Use `$HOME` instead of literal home paths.

### Step 2: Tell the user to run it

Present the exact command for the user to paste into their **own** terminal (with
`$LAUNCH` resolved to the real absolute path):

```
bash "<absolute path>/scripts/launch.sh"
```

To scan a specific directory instead of the stored config / current directory,
they can append `--scan <dir>`:

```
bash "<absolute path>/scripts/launch.sh" --scan ~/code
```

`launch.sh` resolves the bundled `tui/cli.mjs` relative to its own location and
`exec node`s it in the foreground — no port, no background process, nothing to
stop afterwards. Requires `node` (>= 24).

### Step 3: Keybindings

Once it opens:

- `j`/`k` or `↑`/`↓` — move the selection within the focused pane
- `h`/`l` or `←`/`→` — move focus across the panes (rail → list → detail)
- `Tab` or `1`–`6` — switch the status filter
- `Space` — toggle the session-history detail
- `q` or `Ctrl+C` — quit (restores the terminal cleanly)

Leave it running while you work — the portfolio updates live as checkpoints and
PRDs change.
