---
name: dev-resume
description: >-
  Resume work from a previous session checkpoint.
  Loads checkpoint.md, verifies git state, and presents
  a resumption summary before continuing.
  Use at the start of a new session to restore context from a previous checkpoint.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Bash(node:*) Read
---

## Resume From Checkpoint

### Step 0: Discover Project Root

Run the [discovery script](scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within this skill's directory.

**Path safety** — shell state does not persist between tool calls, so you must provide full script paths on each call:
- **Use `$HOME`** instead of the literal home directory (e.g., `bash "$HOME/code/…/discover.sh"`, not `bash "/Users/name/…/discover.sh"`). This prevents username hallucination.
- **Copy values from tool output.** When reusing a value returned by a previous command (like `$PROJECT_ROOT`), copy it verbatim from that command's output. Never retype a path from memory.
- **Verify on first call**: if a script call fails with "No such file", the path is wrong — STOP and re-derive from the skill-loading context.
- **Never ignore a non-zero exit.** If any script in this skill fails, stop and report the error before continuing.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

### Step 1: Identify Feature to Resume

Run the [discovery script](scripts/discover.sh) to find checkpoints:

```bash
bash "$DISCOVER" checkpoints "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): inform the user, stop.
- If output is empty: no checkpoints found, ask what to work on.
- If one line: use as `$CHECKPOINT_PATH`.
- If multiple lines: ask which feature to resume.

Never construct paths from raw `$ARGUMENTS`. Use only paths from script output.

After selection, validate with the [validation script](scripts/validate.sh):

```bash
bash "$VALIDATE" checkpoint-path "$CHECKPOINT_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** — do not continue with an unvalidated path.

### Step 2: Gather Git State

Run the [git state script](scripts/git-state.sh):

```bash
bash "$GIT_STATE" brief
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

Parse the output lines:
- `git:false` → not a git repo, skip git-related checks
- `branch:<name>` → store as `$CURRENT_BRANCH`
- `uncommitted:<true|false>` → store as `$HAS_UNCOMMITTED`

### Step 3: Load Checkpoint and Feature Data via CLI

Run the CLI to get structured checkpoint and feature data:

```bash
node "$CLI" checkpoint-read --json --dir "$FEATURE_DIR"
```

```bash
node "$CLI" feature-show --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). `$FEATURE_DIR` is the parent directory of `$CHECKPOINT_PATH`.

Parse the JSON output:
- **checkpoint-read** returns: `branch`, `lastCommit`, `uncommittedChanges`, `checkpointed`, `context`, `nextAction`, `decisions[]`, `blockers[]`, `notes[]`
- **feature-show** returns: `name`, `status`, `progress {done, total, percent}`, `currentPhase {number, total, title}`, `lastCheckpoint`, `nextAction`, `summary`

### Step 4: Check Context Validity

Compare the checkpoint data against the current git state from Step 2:

| Check | Checkpoint value | Current | Match? |
|-------|-----------------|---------|--------|
| Branch | `branch` from checkpoint-read | `$CURRENT_BRANCH` | Compare |
| Uncommitted | `uncommittedChanges` from checkpoint-read | `$HAS_UNCOMMITTED` | Compare |

Determine status:
- **Fresh**: Branch matches, checkpoint is recent (< 3 days old based on `checkpointed` timestamp)
- **Stale**: Branch matches but checkpoint is old (informational warning)
- **Drifted**: Branch mismatch → warn and ask: "Checkpoint was on `X`, you're on `Y`. Switch or continue?"

### Step 5: Present Resumption Summary

Build the summary from the CLI output:

```
**Status**: [currentPhase from feature-show] — [progress.done]/[progress.total] ([progress.percent]%)
**Last session**: [Derive from checkpoint context field]
**Decisions**: [decisions array from checkpoint-read, or "None recorded"]
**Watch out for**: [blockers array from checkpoint-read, or "Nothing flagged"]

**Start with**: [First concrete action from nextAction field]
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

After completing a phase's work, run the CLI to mechanically verify gate status:

```bash
node "$CLI" gate-check --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory.

The command returns exit 0 when at a gate (`atGate: true`) or when all phases are complete (`allComplete: true`), and exit 2 when work is still in progress. Use this to confirm phase completion rather than relying on visual inspection of markdown markers.

At every gate (whether detected by `gate-check` or by `⏸️ **GATE**:` markers in the PRD) — this is a HARD STOP:
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
