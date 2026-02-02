---
description: Resume work from a previous session checkpoint
argument-hint: <feature name>
version: 3
reads: $PROJECT_ROOT/.dev/<feature-name>/checkpoint.md, $PROJECT_ROOT/.dev/<feature-name>/*.md
---

## Resume From Checkpoint

### Agents

This command uses a specialized agent for context loading:

- **context-loader** (yellow) — Parses checkpoint, compares git state, and builds context summary

Agent definition is in `plugins/dev-workflow/agents/`.

### Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this command.

### Step 1: Identify Feature to Resume

First, check if a `$PROJECT_ROOT/.dev/` directory exists. If it does not exist, inform me that no `$PROJECT_ROOT/.dev/` directory was found and ask what I'd like to work on. Do not proceed further.

If `$PROJECT_ROOT/.dev/` exists, find all available checkpoints:

```bash
find "$PROJECT_ROOT/.dev" -name "checkpoint.md" -type f
```

**If an argument was provided** (`$ARGUMENTS`):
- Filter the checkpoint list to those whose path contains the argument (case-insensitive match)
- If exactly one match: use that checkpoint
- If multiple matches: ask which of the matching features to resume
- If no matches: inform me that no features match "$ARGUMENTS" and list all available features

**If no argument was provided**:
- If multiple checkpoints exist: ask me "Which feature would you like to resume?" and list the available features
- If only one checkpoint exists: use that one
- If no checkpoints exist: ask me which task I'd like to work on

### Step 2: Gather Git State

Before launching the agent, gather the current git state:

```bash
git branch --show-current
git status --porcelain | head -1  # Check if there are uncommitted changes
```

Store these values:
- `$CURRENT_BRANCH` — current branch name
- `$HAS_UNCOMMITTED` — true if `git status --porcelain` has output, false otherwise

### Step 3: Load and Analyze Checkpoint with Agent

Launch the **context-loader agent** to parse the checkpoint and compare state:

```
"Parse the checkpoint at $PROJECT_ROOT/.dev/<feature-name>/checkpoint.md.

Current git state (gathered by parent command):
- Branch: $CURRENT_BRANCH
- Uncommitted changes: $HAS_UNCOMMITTED

Compare this against the checkpoint frontmatter and report any drift.
Extract context summary, decisions, blockers, and next actions.
Read the PRD files listed in the checkpoint."
```

Use `subagent_type=context-loader`.

### Step 4: Review Agent Findings

After the agent returns:

1. **Check context validity**:
   - **Fresh**: Proceed normally
   - **Stale**: Note the age but proceed unless significantly outdated
   - **Drifted**: Warn about branch mismatch or significant changes

2. **Handle warnings**:
   - If branch mismatch: Ask "Checkpoint was on branch `X`, you're now on `Y`. Switch branch or continue?"
   - If uncommitted changes resolved: Note "Uncommitted changes from the checkpoint appear to have been resolved."

### Step 5: Present Resumption Summary

Present the agent's summary in this format:

```
**Status**: [Current phase/step from context]
**Last session**: [1-sentence summary of what was accomplished]
**Decisions**: [Key decisions, or "None recorded"]
**Watch out for**: [Blockers, or "Nothing flagged"]

**Start with**: [Concrete first action from next steps]
```

**Wait for go-ahead** — do not proceed until I confirm.

### Step 6: Handling Discrepancies

When resuming, you may find the codebase has drifted from the checkpoint. Follow these rules:

| Situation | Action |
|-----------|--------|
| File differs from checkpoint description (based on `git diff` or content mismatch) | Proceed, note the drift in summary |
| Key file missing or renamed | **STOP** — ask me how to proceed |
| New files not mentioned in checkpoint | Proceed, mention them |
| Branch mismatch | Ask (handled in Step 4) |
| PRD files missing | **STOP** — cannot resume without PRD |

### Step 7: Read Key Files

Before beginning work, read the key files identified by the agent:
- Main PRD (`00-master-plan.md`)
- Current sub-PRD (if applicable)
- Any key implementation files mentioned

This ensures full context before starting work.

### Step 8: Begin Work

After confirmation, proceed with the first action from the agent's summary. Follow the PRD phases and gates.

**CRITICAL: PHASE GATE ENFORCEMENT**

When you encounter a phase gate in the PRD (marked with `⏸️ **GATE**:`):

1. **STOP IMMEDIATELY** — Do not proceed to the next phase
2. **Report completion** — Tell the user what was accomplished in this phase
3. **Ask explicitly**: "Phase [N] complete. Continue to Phase [N+1] or run `/dev-checkpoint`?"
4. **Wait for user response** — Do NOT proceed until the user explicitly says to continue

This is a HARD STOP, not a suggestion. Phase gates exist to give the user control over progress. Ignoring them defeats the purpose of the checkpoint system.

## PRIVACY RULES

When resuming, verify that checkpoint and PRD files do not contain sensitive information. If you find any of the following, warn the user:
- Absolute paths containing usernames (e.g., `/Users/username/...`)
- Secrets, API keys, tokens, or credentials
- Personal information that shouldn't be stored
