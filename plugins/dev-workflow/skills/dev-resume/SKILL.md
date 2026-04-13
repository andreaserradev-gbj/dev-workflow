---
name: dev-resume
description: >-
  Resume work from a previous session checkpoint.
  Uses `resume-context` CLI to load feature, checkpoint, git state,
  and session history in a single call, then synthesizes a
  focused resumption summary before continuing.
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
- If one line: use as `$FEATURE_DIR` (directory containing the checkpoint).
- If multiple lines: ask which feature to resume.

Never construct paths from raw `$ARGUMENTS`. Use only paths from script output.

After selection, validate with the [validation script](scripts/validate.sh):

```bash
bash "$VALIDATE" checkpoint-path "$CHECKPOINT_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** — do not continue with an unvalidated path.

Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

### Step 2: Load Context via `resume-context`

Make a single call to `resume-context` — this replaces the previous Steps 2–5 (git-state, checkpoint-read, feature-show, validity comparison):

```bash
node "$CLI" resume-context --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

Parse the JSON output. It contains all the data previously gathered across multiple tool calls:

- **`feature`**: `{ name, status, progress {done, total, percent}, currentPhase {number, total, title} }`
- **`checkpoint`**: `{ context, nextAction, decisions[], blockers[], notes[] }`
- **`validity`**: `"fresh"` | `"stale"` | `"drifted"` — pre-computed branch match + freshness check
- **`validityDetails`**: `{ checkpointBranch, currentBranch, checkpointUncommitted, currentUncommitted }`
- **`currentPhasePrd`**: Extracted markdown section for the current phase only (not the full master plan)
- **`referenceFiles`**: File paths from the master plan's "Reference Files" section
- **`sessionHistory`**: Last N sessions from `session-log.md` (default 5, use `--sessions=all` for all)
- **`accumulatedDecisions`**: Union of all `<decisions>` across all sessions, deduplicated

The LLM no longer calls: `git-state.sh`, `checkpoint-read --json`, `feature-show --json`. It no longer compares branches manually. It no longer reads the full master plan (`currentPhasePrd` contains just the relevant section).

**Check the exit code.** A non-zero exit code means the command failed (e.g., feature directory not found, no checkpoint). **Never ignore a non-zero exit** — if `resume-context` fails, stop and report the error. Do not attempt to reconstruct the data from separate tool calls.

### Step 3: Check Context Validity

Read the `validity` field from the `resume-context` output:

- **`fresh`**: Branch matches, checkpoint is recent (< 3 days old). Proceed normally.
- **`stale`**: Branch matches but checkpoint is old. Show an informational warning, then proceed.
- **`drifted`**: Branch mismatch. Warn and ask: "Checkpoint was on `X`, you're on `Y`. Switch or continue?" Wait for user response before proceeding.

If `"drifted"`, the `validityDetails` field shows both branch names for the prompt.

### Step 4: Present Resumption Summary

Synthesize the resumption summary from the `resume-context` output. **This is the irreplaceable LLM step** — the CLI handles the mechanics; the LLM handles the judgment.

```
**Status**: [feature.currentPhase.title] — [feature.progress.done]/[feature.progress.total] ([feature.progress.percent]%)
**Last session**: [Derive from checkpoint.context field]
**Decisions**: [checkpoint.decisions, or "None recorded"]
**Session history**: [sessionHistory.length sessions tracked, accumulatedDecisions.length total decisions]
**Watch out for**: [checkpoint.blockers, or "Nothing flagged"]

**Current phase PRD**: [currentPhasePrd — summarize or reference; don't re-read the full master plan]

**Start with**: [First concrete action from checkpoint.nextAction field]
```

Incorporate `accumulatedDecisions` when relevant — decisions from earlier sessions may contextualize the current step.

**Wait for go-ahead** — do not proceed until the user confirms.

### Step 5: Handling Discrepancies

| Situation | Action |
|-----------|--------|
| File differs from checkpoint | Proceed, note drift |
| Key file missing or renamed | **STOP** — ask how to proceed |
| New files not in checkpoint | Proceed, mention them |
| PRD files missing | **STOP** — cannot resume without PRD |

### Step 6: Read Key Files and Reference Patterns

Before beginning work:
1. The `currentPhasePrd` field from `resume-context` contains the relevant phase section — read it instead of the full master plan
2. Use `referenceFiles` from the `resume-context` output to identify which files to read — these are the PRD's recommended reference implementations
3. Read 2-3 of those reference files and match their conventions (naming, structure, APIs, error handling) in new code

Never write new code from scratch when similar code already exists in the codebase.

### Step 7: Begin Work

After confirmation, proceed with the first action from the agent's summary. Follow the PRD phases and gates.

**CRITICAL: PHASE GATE ENFORCEMENT**

After completing a phase's work, run the CLI to mechanically verify gate status:

```bash
node "$CLI" gate-check --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory.

The command always returns exit 0 on success (exit 1 on error). Check the `atGate` and `allComplete` fields in the JSON output to determine gate status. Use this to confirm phase completion rather than relying on visual inspection of markdown markers.

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
