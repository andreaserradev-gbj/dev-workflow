---
name: dev-resume
description: >-
  Resume work from a previous session checkpoint.
  Loads checkpoint.md, verifies git state, and presents
  a resumption summary before continuing.
  Use at the start of a new session to restore context from a previous checkpoint.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Read
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

> **REQUIRED**: Before ANY implementation work, write the session-state file below. Do NOT skip this.

Write the session-state file to signal an active session:

Write `$PROJECT_ROOT/.dev/$FEATURE_NAME/session-state.json`:
```json
{
  "status": "active",
  "phase": null,
  "gate_label": null,
  "since": "<current ISO 8601 timestamp>"
}
```

Generate the timestamp via `date -u +"%Y-%m-%dT%H:%M:%SZ"`.

Then proceed with the first action from the agent's summary. Follow the PRD phases and gates.

**CRITICAL: PHASE GATE ENFORCEMENT**

At every `⏸️ **GATE**:` in the PRD — this is a HARD STOP:
1. **STOP** — Do not proceed to the next phase
2. Write `$PROJECT_ROOT/.dev/$FEATURE_NAME/session-state.json`:
   ```json
   {
     "status": "gate",
     "phase": <current phase number>,
     "gate_label": "<the gate prompt text>",
     "since": "<current ISO 8601 timestamp>"
   }
   ```
3. **Report** what was accomplished
4. **Ask**: "Phase [N] complete. Continue to Phase [N+1] or `/dev-checkpoint`?"
5. **Wait** for explicit user response before continuing

When the user confirms to continue, overwrite `session-state.json` back to `"active"` (with `phase: null`, `gate_label: null`, fresh timestamp) before starting the next phase.

**STEP-LEVEL STOPS**

After completing each implementation step within a phase:
1. Report what was completed
2. Ask: "Step done. Continue to next step?"
3. Wait for confirmation before proceeding

This prevents jumping ahead to the next task before the current one is tested.

## PRIVACY RULES

Warn the user if checkpoint/PRD files contain: absolute paths with usernames, secrets/credentials, or personal information.
