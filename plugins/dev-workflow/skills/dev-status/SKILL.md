---
name: dev-status
description: >-
  Show status of all features in .dev/.
  Scans feature folders using parallel agents, generates
  a status report, and offers to archive completed features.
---

## Dev Status Report

Scan all features in the `.dev/` folder, generate a status report, and offer to archive completed or stale features.

### Agents

This skill uses a specialized agent for status scanning:

- **feature-batch-scanner** (blue) — Scans a batch of feature folders and extracts status for each

Agent definition is in `plugins/dev-workflow/agents/`.

### Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this skill.

### Step 1: Discover Features

Find all feature directories, excluding the archive folder:

```bash
find "$PROJECT_ROOT/.dev" -maxdepth 1 -type d ! -name ".dev" ! -name ".dev-archive" | sort
```

Also check for archived features:

```bash
find "$PROJECT_ROOT/.dev-archive" -maxdepth 1 -type d ! -name ".dev-archive" 2>/dev/null | sort
```

**If no `.dev/` directory exists**: Inform the user "No `.dev/` directory found. Use `/dev-plan` to start a new feature."

**If `.dev/` exists but has no feature folders**: Inform the user "No features found in `.dev/`. Use `/dev-plan` to start a new feature."

Store the list of feature folder paths for the next step.

### Step 2: Calculate Batches

Distribute feature folders across agents (maximum 5 agents):

- **If N ≤ 5 features**: Launch N agents, 1 folder each
- **If N > 5 features**: Launch 5 agents, distribute folders round-robin

**Batch distribution algorithm** (for N > 5):

```
Agent 1: folders[0], folders[5], folders[10], ...
Agent 2: folders[1], folders[6], folders[11], ...
Agent 3: folders[2], folders[7], folders[12], ...
Agent 4: folders[3], folders[8], folders[13], ...
Agent 5: folders[4], folders[9], folders[14], ...
```

### Step 3: Launch Parallel Agents

Launch all **feature-batch-scanner** agents in parallel using the Task tool.

For each agent, provide a prompt like:

```
"Scan these feature folders and return status for each:
- $PROJECT_ROOT/.dev/feature-a
- $PROJECT_ROOT/.dev/feature-b
- $PROJECT_ROOT/.dev/feature-c

For each folder, determine: Status (Active/Complete/Stale/No PRD), Progress (phases and steps), Last Checkpoint date, and Next Action."
```

Use `subagent_type=dev-workflow:feature-batch-scanner` and `model=haiku` for each agent.

**IMPORTANT**: Launch all agents in a single message with multiple Task tool calls to run them in parallel.

### Step 4: Aggregate Results

After all agents return:

1. Parse each agent's batch results
2. Combine into a unified list of all features
3. Sort by status: Active first, then Stale, then Complete, then No PRD
4. Calculate summary counts

### Step 5: Present Report

Display the status report to the user:

```markdown
## Dev Status Report

**Generated**: [ISO 8601 timestamp]
**Features Scanned**: [N]

### Summary

| Status | Count |
|--------|-------|
| Active | [X] |
| Complete | [Y] |
| Stale | [Z] |
| No PRD | [W] |

### All Features

| Feature | Status | Progress | Last Activity | Next Action |
|---------|--------|----------|---------------|-------------|
| [name] | [status] | [X/Y phases] | [date/ago] | [summary] |
...
```

If there are archived features, add a section:

```markdown
### Archived Features

[N] features in `.dev-archive/`:
- [feature-name-1]
- [feature-name-2]
```

### Step 6: Archive Offer

If there are any **Complete** or **Stale** features, ask the user:

"Would you like to archive any completed or stale features? This moves them to `.dev-archive/` to keep `.dev/` clean."

Present options:
1. Archive all complete features
2. Archive all stale features
3. Archive specific features (list them)
4. Skip archiving

**If user chooses to archive**:

1. Create `.dev-archive/` if it doesn't exist:
   ```bash
   mkdir -p "$PROJECT_ROOT/.dev-archive"
   ```

2. Move each selected feature folder:
   ```bash
   mv "$PROJECT_ROOT/.dev/[feature-name]" "$PROJECT_ROOT/.dev-archive/"
   ```

3. Confirm what was archived.

**If user skips**: Proceed to Step 7.

### Step 7: Save Report

Write the status report to `$PROJECT_ROOT/.dev/status-report-YYYY-MM-DD.md`:

```markdown
# Dev Status Report

**Generated**: [ISO 8601 timestamp]
**Project**: [project name from git or folder]
**Features Scanned**: [N]

## Summary

| Status | Count |
|--------|-------|
| Active | [X] |
| Complete | [Y] |
| Stale | [Z] |
| No PRD | [W] |

## Features

| Feature | Status | Progress | Last Activity |
|---------|--------|----------|---------------|
| [name] | [status] | [X/Y phases] | [date] |
...

## Archive Candidates

### Complete (ready to archive)
- [feature-name]
...

### Stale (no activity > 30 days)
- [feature-name]
...

---

*Report generated by `/dev-status`*
```

Confirm: "Status report saved to `.dev/status-report-YYYY-MM-DD.md`"

### Privacy Rules

**NEVER include in output or saved reports:**
- Absolute paths containing usernames (e.g., `/Users/username/...`)
- Secrets, API keys, tokens, or credentials
- Personal information

**ALWAYS use instead:**
- Relative paths from project root (e.g., `.dev/feature-name/`)
- Feature names without full paths in tables
