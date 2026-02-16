---
name: dev-resume
description: >-
  Resume work from a previous session checkpoint.
  Loads checkpoint.md, verifies git state, and presents
  a resumption summary before continuing.
argument-hint: <feature name>
allowed-tools: Bash(git rev-parse:*) Bash(git branch:*) Bash(git status:*) Bash(find:*) Bash(printf:*) Bash(basename:*) Bash(test:*) Read
---

## Resume From Checkpoint

### Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this skill.

### Step 1: Identify Feature to Resume

First, check if a `$PROJECT_ROOT/.dev/` directory exists. If it does not exist, inform the user that no `$PROJECT_ROOT/.dev/` directory was found and ask what to work on. Do not proceed further.

If `$PROJECT_ROOT/.dev/` exists, find all available checkpoints:

```bash
CHECKPOINT_PATHS="$(find "$PROJECT_ROOT/.dev" -name "checkpoint.md" -type f | sort)"
printf '%s\n' "$CHECKPOINT_PATHS"
```

Store this list as `$CHECKPOINT_PATHS`.

**If an argument was provided** (`$ARGUMENTS`):
- Filter the checkpoint list with a fixed-string, case-insensitive match:
  ```bash
  MATCHES="$(printf '%s\n' "$CHECKPOINT_PATHS" | grep -iF -- "$ARGUMENTS" || true)"
  ```
- If exactly one match: use that checkpoint path as `$CHECKPOINT_PATH`
- If multiple matches: ask which of the matching features to resume
- If no matches: inform the user that no features match "$ARGUMENTS" and list all available features

**If no argument was provided**:
- If multiple checkpoints exist: ask "Which feature would you like to resume?" and list the available features
- If only one checkpoint exists: use that checkpoint path as `$CHECKPOINT_PATH`
- If no checkpoints exist: ask which task to work on

After selection, derive and validate:

```bash
FEATURE_NAME="$(basename "$(dirname "$CHECKPOINT_PATH")")"
case "$CHECKPOINT_PATH" in
  "$PROJECT_ROOT/.dev/"*) ;;
  *) echo "Invalid checkpoint path: $CHECKPOINT_PATH"; exit 1 ;;
esac
printf '%s' "$FEATURE_NAME" | grep -Eq '^[a-z0-9][a-z0-9-]*$' \
  || { echo "Invalid feature name slug: $FEATURE_NAME"; exit 1; }
```

Rules:
- Never construct checkpoint paths directly from raw `$ARGUMENTS`.
- Use only `$CHECKPOINT_PATH` values discovered from `find`.

### Step 2: Gather Git State

Run `git branch --show-current` and `git status --porcelain | head -1`. Store as `$CURRENT_BRANCH` and `$HAS_UNCOMMITTED` (true if porcelain has output).

### Step 3: Load and Analyze Checkpoint with Agent

Launch the **context-loader agent** to parse the checkpoint and compare state:

```
"Parse the checkpoint at $CHECKPOINT_PATH.

Current git state (gathered by parent skill):
- Branch: $CURRENT_BRANCH
- Uncommitted changes: $HAS_UNCOMMITTED

Compare this against the checkpoint frontmatter and report any drift.
Extract context summary, decisions, blockers, and next actions.
Read the PRD files listed in the checkpoint."
```

Use `subagent_type=dev-workflow:context-loader` and `model=haiku`.

### Step 4: Review Agent Findings

After the agent returns, check context validity:
- **Fresh/Stale**: Proceed (note age if stale)
- **Drifted**: Warn. If branch mismatch, ask: "Checkpoint was on `X`, you're on `Y`. Switch or continue?"

### Step 5: Present Resumption Summary

Present the agent's summary in this format:

```
**Status**: [Current phase/step from context]
**Last session**: [1-sentence summary of what was accomplished]
**Decisions**: [Key decisions, or "None recorded"]
**Watch out for**: [Blockers, or "Nothing flagged"]

**Start with**: [Concrete first action from next steps]
```

**Wait for go-ahead** — do not proceed until the user confirms.

### Step 6: Handling Discrepancies

| Situation | Action |
|-----------|--------|
| File differs from checkpoint | Proceed, note drift |
| Key file missing or renamed | **STOP** — ask how to proceed |
| New files not in checkpoint | Proceed, mention them |
| PRD files missing | **STOP** — cannot resume without PRD |

### Step 7: Read Key Files and Reference Patterns

Before beginning work:
1. Read the main PRD (`00-master-plan.md`), current sub-PRD, and key implementation files
2. Find 2-3 similar implementations from the PRD's "Reference Files" or "Codebase Patterns" sections
3. Read those files and match their conventions (naming, structure, APIs, error handling) in new code

Never write new code from scratch when similar code already exists in the codebase.

### Step 8: Begin Work

After confirmation, proceed with the first action from the agent's summary. Follow the PRD phases and gates.

**CRITICAL: PHASE GATE ENFORCEMENT**

At every `⏸️ **GATE**:` in the PRD — this is a HARD STOP:
1. **STOP** — Do not proceed to the next phase
2. **Report** what was accomplished
3. **Ask**: "Phase [N] complete. Continue to Phase [N+1] or `/dev-checkpoint`?"
4. **Wait** for explicit user response before continuing

**STEP-LEVEL STOPS**

After completing each implementation step within a phase:
1. Report what was completed
2. Ask: "Step done. Continue to next step?"
3. Wait for confirmation before proceeding

This prevents jumping ahead to the next task before the current one is tested.

## PRIVACY RULES

Warn the user if checkpoint/PRD files contain: absolute paths with usernames, secrets/credentials, or personal information.
