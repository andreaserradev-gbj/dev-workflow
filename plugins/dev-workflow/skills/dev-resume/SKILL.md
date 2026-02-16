---
name: dev-resume
description: >-
  Resume work from a previous session checkpoint.
  Loads checkpoint.md, verifies git state, and presents
  a resumption summary before continuing.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Read
---

## Resume From Checkpoint

### Step 0: Discover Project Root

Run the [discovery script](../../scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within the plugin directory. Inline actual values — do not rely on shell variables persisting between calls.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

### Step 1: Identify Feature to Resume

Run the [discovery script](../../scripts/discover.sh) to find checkpoints:

```bash
bash "$DISCOVER" checkpoints "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): inform the user, stop.
- If output is empty: no checkpoints found, ask what to work on.
- If one line: use as `$CHECKPOINT_PATH`.
- If multiple lines: ask which feature to resume.

Never construct paths from raw `$ARGUMENTS`. Use only paths from script output.

After selection, validate with the [validation script](../../scripts/validate.sh):

```bash
bash "$VALIDATE" checkpoint-path "$CHECKPOINT_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within the plugin directory. Inline actual values. Outputs `$FEATURE_NAME` on success; on failure, STOP and report the error.

### Step 2: Gather Git State

Run the [git state script](../../scripts/git-state.sh):

```bash
bash "$GIT_STATE" brief
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within the plugin directory. Inline actual values.

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
