---
name: dev-wiki
description: >-
  Generate and browse the cross-project wiki index.
  Creates a navigable markdown wiki from .dev/ and .dev-archive/ PRDs,
  ready for Obsidian or any markdown viewer.
argument-hint: "[--init]"
allowed-tools: Bash(node:*) Bash(bash:*) Read
---

## Generate Dev Wiki

Generate a cross-project wiki index from all `.dev/` and `.dev-archive/` PRDs. The wiki is a set of markdown files (`index.md`, `log.md`) and a symlink farm pointing to actual PRD directories — browsable in Obsidian, queryable by other skills.

### Step 0: Discover Project Root

Run the [discovery script](scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within this skill's directory.

**Path safety** — shell state does not persist between tool calls, so you must provide full script paths on each call:
- **Use `$HOME`** instead of the literal home directory.
- **Copy values from tool output.** When reusing a value returned by a previous command, copy it verbatim from that command's output. Never retype a path from memory.
- **Never ignore a non-zero exit.** If any script fails, stop and report the error.

Store the output as `$PROJECT_ROOT`.

### Step 1: Generate Wiki

Run the CLI to generate the wiki:

```bash
node "$CLI" wiki-index --generate --scan "$PROJECT_ROOT"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory.

This writes:
- `~/.dev-wiki/index.md` — cross-project feature catalog
- `~/.dev-wiki/log.md` — chronological activity record
- `~/.dev-wiki/projects/` — symlinks to each project's `.dev/` and `.dev-archive/`
- `~/.dev-wiki/README.md` — Obsidian setup instructions
- `~/.dev-wiki/.obsidian/app.json` — sensible defaults

Report the output to the user.

### Step 2: Obsidian Setup (if `--init` or first run)

If the user passed `--init`, or if this is the first time the wiki was generated, provide Obsidian setup instructions:

1. **Install Obsidian**: Download from https://obsidian.md (free for personal use)
2. **Open the vault**: File > Open Vault > Browse > select `~/.dev-wiki/`
3. **Recommended plugins**:
   - **Dataview** — query YAML frontmatter across features (Settings > Community plugins > Browse > search "Dataview")
   - **Graph View** (built-in) — click the graph icon in the left sidebar to visualize connections between features

4. **Example Dataview query** — create a new note and paste:

   ````
   ```dataview
   TABLE status, progress
   FROM "projects"
   WHERE status != "archived"
   SORT progress DESC
   ```
   ````

### Step 3: Status Summary

Run the CLI to get current stats:

```bash
node "$CLI" wiki-index --json --scan "$PROJECT_ROOT"
```

Report: number of projects, features, and the wiki directory path.

If the dashboard server is running, the wiki auto-updates on every PRD change (no need to re-run this skill). If the server is not running, re-run `/dev-wiki` to refresh.
