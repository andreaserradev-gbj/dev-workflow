---
name: dev-board
description: >-
  Generate a project dashboard from .dev/ feature data.
  Produces an HTML board and a stakeholder markdown summary.
allowed-tools: Bash(bash:*) Read Write
---

## Dev Board

Generate a visual project dashboard and stakeholder summary from `.dev/` PRD files.

### Agents

This skill uses a specialized agent for PRD parsing:

- **board-generator** (magenta) — Parses all feature PRDs and returns structured progress data

Agent definition is in `agents/` within this skill's directory.

### Step 0: Discover Project Root

Run the [discovery script](scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within this skill's directory. Inline actual values — do not rely on shell variables persisting between calls.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

### Step 1: Discover Features

Run the [discovery script](scripts/discover.sh) to find features:

```bash
bash "$DISCOVER" features "$PROJECT_ROOT"
```

- If the script exits non-zero (no `.dev/` directory): inform the user "No `.dev/` directory found. Use `/dev-plan` to start a new feature."
- If output is empty: inform the user "No features found in `.dev/`. Use `/dev-plan` to start a new feature."
- Otherwise: store the list of feature folder paths for the next step.

### Step 2: Parse Feature Data

Launch the **board-generator** agent with the list of feature paths.

Provide a prompt like:

```
"Scan these feature folders and return structured progress data for each:
- $PROJECT_ROOT/.dev/feature-a
- $PROJECT_ROOT/.dev/feature-b

For each folder, extract: Status, Created/Updated dates, Last Checkpoint, Summary, Phase progress (phases and steps), Sub-PRD progress, and Next Action."
```

Use `subagent_type=dev-workflow:board-generator` and `model=haiku`.

After the agent returns, present a summary of the parsed data to the user:

```markdown
## Parsed Feature Data

**Features found**: [N]

| Feature | Status | Progress | Next Action |
|---------|--------|----------|-------------|
| [name]  | [status] | [X/Y phases, A/B steps] | [summary] |
```

### Step 3: Generate HTML Board

Build `$PROJECT_ROOT/.dev/board.html` from the agent's output and the HTML template.

#### 3a. Derive metadata

- **Project name**: Run `basename $(git rev-parse --show-toplevel 2>/dev/null || pwd)`.
- **Timestamp**: Use the current date/time in ISO 8601 format (e.g., `2026-03-02T14:30:00Z`).

#### 3b. Build the BOARD_DATA object

The agent returns a JSON array of feature objects. Wrap it into the full data contract:

```json
{
  "projectName": "<from 3a>",
  "generatedAt": "<from 3a>",
  "summary": { "total": N, "active": N, "complete": N, "stale": N, "noPrd": N },
  "features": <agent JSON array>
}
```

Compute `summary` by counting feature statuses across the array:
- `total`: array length
- `active`: features with `status === "active"`
- `complete`: features with `status === "complete"`
- `stale`: features with `status === "stale"`
- `noPrd`: features with `status === "no-prd"`

#### 3c. Inject into template and write

1. Read `references/board-template.html` within this skill's directory.
2. Serialize the JSON object (no indentation needed, compact is fine).
3. Replace the `<!-- BOARD_DATA -->` comment in the template with:
   ```html
   <script>const BOARD_DATA = <JSON>;</script>
   ```
4. Write the result to `$PROJECT_ROOT/.dev/board.html`.

### Step 4: Generate Stakeholder Markdown

_Stakeholder markdown generation — see Sub-PRD 3._

Generate a platform-neutral markdown summary from the agent's structured data. Write to `$PROJECT_ROOT/.dev/board-stakeholder.md`.

### Step 5: Report

Tell the user what was generated:

```
Generated:
- `.dev/board.html` — Open in a browser to view the project dashboard
- `.dev/board-stakeholder.md` — Copy-paste into GitHub, Confluence, Slack, etc.

[N] features scanned: [X] active, [Y] complete, [Z] stale
```

### Privacy Rules

**NEVER include in output or saved files:**
- Absolute paths containing usernames (e.g., `/Users/username/...`)
- Secrets, API keys, tokens, or credentials
- Personal information

**ALWAYS use instead:**
- Relative paths from project root (e.g., `.dev/feature-name/`)
- Feature names without full paths
