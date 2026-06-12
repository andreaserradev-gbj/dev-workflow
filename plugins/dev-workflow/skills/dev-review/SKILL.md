---
name: dev-review
description: >-
  Generate an architect-readable alignment report comparing a feature's PRD
  against the actual implementation. Spawns a fresh reporter subagent that
  explores the codebase and reports deviations first, what was built and how
  it works, architectural-constraint limits, and what is untested.
  Use when implementation is finished (or nearly), before final testing.
argument-hint: "[feature]"
allowed-tools: Bash(bash:*) Bash(node:*) Bash(git rev-parse:*) Bash(git diff:*) Bash(git log:*) Bash(git status:*) Read Write
---

## Review a Feature's PRD-vs-Implementation Alignment

Compare a feature's PRD against what was actually built, then surface an architect-readable prose report: deviations first, then what was built and how it works, the limits imposed by the architecture, and what remains untested. The audience is the architect who designed the feature but has NOT read the code. The report is produced by a fresh `feature-reporter` subagent so the assessment is grounded in the codebase, not in this session's assumptions.

### REVIEW-ONLY MODE

This skill reads, explores, and reports. It does NOT modify the project.

- Do NOT call `Edit` on any file.
- Do NOT fix bugs, implement steps, or change code — even if the report surfaces gaps.
- Do NOT update PRD status markers, checkpoints, or session logs.
- Do NOT commit, push, or otherwise advance the work.
- **One carve-out**: you MAY `Write` a single file — `.dev/<feature>/review.md` — but only in Step 6, only after the report has been presented, and only on explicit user confirmation.

If the report surfaces work to do, point the user at their workflow (re-implement the gap, or `/dev-checkpoint` to capture it) — but do not perform either yourself.

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

### Step 1: Locate the Feature

Run the [discovery script](scripts/discover.sh) to find features:

```bash
bash "$DISCOVER" features "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): inform the user there is no feature to review, and stop.
- If output is empty: no matching feature found — ask the user to specify the feature name.
- If one line: use as `$FEATURE_PATH`.
- If multiple lines: ask the user which feature to review.

Never use raw `$ARGUMENTS` directly in shell commands or paths.

Validate with the [validation script](scripts/validate.sh):

```bash
bash "$VALIDATE" feature-path "$FEATURE_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** and report the error.

Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

### Step 2: Load Feature State

Run the CLI to read the feature's `status`, `progress`, and `currentPhase`:

```bash
node "$CLI" feature-show --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. (This returns high-level state, not the full phase breakdown — that comes from reading the master plan in Step 3.)

- If `00-master-plan.md` is missing (the command errors or reports no plan): inform the user the feature has no PRD to review against, and stop.
- The report is most useful when implementation is finished — `status` is `complete`, or `progress.done` equals `progress.total`. But do **not** refuse to run earlier — report on what exists, and say plainly which phases are still pending (from `currentPhase`) so the architect reads the report in that light.

### Step 3: Gather Evidence

Read in parallel:

1. **PRD** — read `$FEATURE_DIR/00-master-plan.md` and every `$FEATURE_DIR/NN-sub-prd-*.md`. This is the design intent the report compares against.
2. **Checkpoint** — read `$FEATURE_DIR/checkpoint.md` if present. Skip if absent.
3. **Git state** — capture branch and uncommitted-changes flag:
   ```bash
   bash "$GIT_STATE" brief
   ```
   Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory.
4. **Diff evidence** — inspect what actually changed via the allowed-tools:
   - `git log --oneline -20` — recent commits, to spot the feature's boundary
   - `git diff HEAD~N` for the N commits attributable to the feature, OR
   - `git diff $(git merge-base HEAD main)` for the full branch diff when the feature is the only work on the branch
   - `git status --short` for uncommitted hunks
   Pick the narrowest diff that fully covers the feature's work. If unsure, prefer the wider diff — the reporter will triage.

### Step 4: Spawn the `feature-reporter` Agent

Use the `Task` tool to launch the `feature-reporter` subagent (`subagent_type=dev-workflow:feature-reporter`, registered in `.claude-plugin/plugin.json`). Pass the gathered evidence as a single bundle:

- **PRD content** — the master plan plus every sub-PRD.
- **Checkpoint contents** (if present).
- **Diff** (the chosen `git diff` output) and the recent commit list.
- **Branch + uncommitted flag** from `git-state.sh brief`.
- **Feature directory path** (`$FEATURE_DIR`) so the agent can explore the codebase itself.

Instruct the agent to apply the report structure from its own definition (`agents/feature-reporter.md`) and to ground every claim in a file path. The report is the agent's final message.

### Step 5: Present the Report

Relay the agent's report to the user **in full**. Do not compress it into bullets, summarize it, or reorder its sections — the prose is the deliverable. If the agent's output is missing one of the four mandatory sections, say so explicitly rather than papering over the gap.

### Step 6: Offer to Save

After presenting the report, ask:

> Save this report to `.dev/$FEATURE_NAME/review.md`?

Only on an explicit **yes**, `Write` the report verbatim to `$FEATURE_DIR/review.md` with a small header — feature name, date, branch, and the commit it was reviewed at. Saving makes the report visible to the dashboard and the wiki.

If the user declines, do nothing — no file is created.

## PRIVACY RULES

If the report (or the evidence it cites) contains absolute paths with usernames, secrets/credentials, or external private-repository references, warn the user before saving and keep the report to relative paths. This skill is REVIEW-ONLY — surface the issue, do not rewrite project files to fix it.
