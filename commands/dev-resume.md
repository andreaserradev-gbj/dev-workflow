---
description: Resume work from a previous session checkpoint
version: 2
reads: $PROJECT_ROOT/.dev/<feature-name>/checkpoint.md, $PROJECT_ROOT/.dev/<feature-name>/*.md
---

## Resume From Checkpoint

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

### Step 2: Load Checkpoint

Read the checkpoint file: `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md`

### Step 3: Verify Checkpoint Context

If the checkpoint has YAML frontmatter (version 2 format), perform these checks:

1. **Branch match**: Compare `branch` in frontmatter to current branch (`git branch --show-current`). If different, warn: "Checkpoint was on branch `X`, you're now on `Y`. Switch branch or continue?"
2. **Staleness check**: Compare `checkpointed` timestamp to now. If older than a few days, note: "This checkpoint is [N] days old." (Informational only — proceed unless context seems significantly outdated.)
3. **Uncommitted changes drift**: If `uncommitted_changes: true` in frontmatter, run `git status --short` and compare. If the working tree is now clean (changes were committed or discarded), note: "Uncommitted changes from the checkpoint appear to have been resolved."

If the checkpoint lacks YAML frontmatter (version 1 format), skip these checks and proceed.

### Step 4: Build Resumption Summary

1. **Read the PRD files** listed at the top of the checkpoint in order. If no PRD files are listed (malformed checkpoint), scan `$PROJECT_ROOT/.dev/<feature-name>/` for `*.md` files and read them instead.
2. **Scan all checkpoint sections** — including `<context>`, `<current_state>`, `<next_action>`, `<key_files>`, `<decisions>`, `<blockers>`, and `<notes>` if present. For version 1 checkpoints without XML tags, use the heading-based sections instead.
3. **Present a focused summary**:

```
**Status**: [Current phase/step from context]
**Last session**: [1-sentence summary of what was accomplished]
**Decisions**: [Key decisions from <decisions>, or "None recorded"]
**Watch out for**: [Blockers from <blockers>, or "Nothing flagged"]

**Start with**: [Concrete first action from <next_action>]
```

4. **Wait for go-ahead** — do not proceed until I confirm.

### Step 5: Handling Discrepancies

When resuming, you may find the codebase has drifted from the checkpoint. Follow these rules:

| Situation | Action |
|-----------|--------|
| File differs from checkpoint description (based on `git diff` or content mismatch) | Proceed, note the drift in summary |
| Key file missing or renamed | **STOP** — ask me how to proceed |
| New files not mentioned in checkpoint | Proceed, mention them |
| Branch mismatch | Ask (handled in Step 3) |
| PRD files missing | **STOP** — cannot resume without PRD |

### Step 6: Begin Work

After confirmation, proceed with the first action from `<next_action>`. Follow the PRD phases and gates.

When you reach a phase gate or context is filling up, run `/dev-checkpoint` to save progress.
