---
name: dev-checkpoint
description: >-
  Save progress and generate a continuation prompt.
  Updates PRD status markers, captures git state,
  and writes checkpoint.md for the next session.
  Use at the end of a session or before switching context.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Bash(node:*) Bash(git add:*) Bash(git commit:*) Bash(git log:*) Bash(git status:*) Bash(rm:*) Read Write
---

## Checkpoint Current Session

Review the current session and create a continuation prompt for the next session.

### SAVE-ONLY MODE

This skill analyzes and saves. It does NOT fix, investigate, or implement anything.

- Do NOT investigate bugs or errors mentioned during the session
- Do NOT start implementing fixes or next steps
- Do NOT move to the next phase or task
- If the user mentions bugs during confirmation (Step 6), note them in `<blockers>` or `<notes>` but do NOT attempt to fix them

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

### Step 1: Identify the Active Feature

Run the [discovery script](scripts/discover.sh) to find features:

```bash
bash "$DISCOVER" features "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): ask the user to specify the feature name.
- If output is empty: no features found, ask the user to specify the feature name.
- If one line: use as `$FEATURE_PATH`.
- If multiple lines: ask which feature to checkpoint.

Never use raw `$ARGUMENTS` directly in shell commands or paths.

Validate with the [validation script](scripts/validate.sh). Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

**If using an existing feature** (a `$FEATURE_PATH` was matched):

```bash
bash "$VALIDATE" feature-path "$FEATURE_PATH" "$PROJECT_ROOT"
```

**If creating a new feature** (no match, normalizing user input):

```bash
bash "$VALIDATE" normalize "$USER_INPUT"
```

Outputs `$FEATURE_NAME` on success; on failure, STOP and report the error.

The checkpoint will be saved to `$PROJECT_ROOT/.dev/$FEATURE_NAME/checkpoint.md`.

### Step 2: Gather Feature State via CLI

Run the CLI to get structured progress and gate data:

```bash
node "$CLI" progress-summary --json --dir "$PROJECT_ROOT/.dev/$FEATURE_NAME"
```

```bash
node "$CLI" gate-check --json --dir "$PROJECT_ROOT/.dev/$FEATURE_NAME"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

Parse the JSON output:
- **progress-summary** returns: `feature`, `overall {done, total, percent}`, `phases[] {number, title, done, total, status}`, `subPrds[] {id, title, done, total, status}`
- **gate-check** returns: `feature`, `atGate`, `completedPhase`, `nextPhase`, `allComplete`

From the CLI output, determine:
- **Current phase**: the first phase with status `in-progress`, or the next `not-started` phase if at a gate
- **Overall progress**: `overall.done`/`overall.total` (`overall.percent`%)

### Step 3: Analyze Session Context

Review the current conversation to extract:
1. **Completed items** — what was accomplished this session (to mark `⬜` → `✅`)
2. **Decisions made** — architectural choices, trade-offs
3. **Blockers encountered** — issues, workarounds, gotchas

Cross-reference with the CLI progress data to verify accuracy. The CLI provides the ground truth for PRD status markers; your session review adds decisions, blockers, and context that only the conversation contains.

### Step 4: Update PRD Status Markers (REQUIRED)

For each completed item identified in Step 3, run the CLI:

```bash
node "$CLI" status-update --phase N --step M --marker done --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). `$FEATURE_DIR` is `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

- `--phase N` — the phase number containing the completed step
- `--step M` — the step number within that phase (omit for phase-level markers)
- `--marker done` — marks the step as ✅ complete

The CLI reports `{ changed, line, file }` as JSON when `--json` is passed, or a text summary otherwise. Track these results for the Step 9 summary. If `changed` is false, the marker was already ✅.

**Check the exit code.** A non-zero exit code means the command failed (e.g., phase not found, invalid path). **Never ignore a non-zero exit** — if a `status-update` call fails, stop and report the error before continuing.

If nothing was completed, state: "No PRD updates needed."

**Do NOT manually edit PRD files** — the `status-update` CLI ensures format compatibility with the parser.

### Step 5: Capture Git State

Run the [git state script](scripts/git-state.sh):

```bash
bash "$GIT_STATE" full
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

Parse the output lines:
- `git:false` → not a git repo; omit `branch`, `lastCommit`, `uncommittedChanges` from the checkpoint JSON.
- `branch:<name>` → store for checkpoint JSON `branch` field
- `commit:<oneline>` → store as checkpoint JSON `lastCommit` field
- `status:<line>` → each is one line of `git status --short`; if no `status:` lines, set `uncommittedChanges` to `false`

### Step 6: Confirm Session Context

Present the agent's findings (decisions, blockers, notes) and end with an explicit question:

> "Does this look right? Reply **yes** to continue, or tell me what to add or change."

If a category is empty, omit it.

**STOP. Wait for explicit confirmation before proceeding to Step 7. If the user mentions new bugs or issues during this step, add them to the checkpoint notes — do NOT investigate or fix them.**

### Step 7: Compose Checkpoint Data

**Rules**:
- Always include `context`, `currentState`, `nextAction`, `keyFiles`. Omit `decisions`, `blockers`, `notes` if empty (empty arrays, not omitted keys).
- No absolute paths with usernames → use relative paths. No secrets/credentials → use placeholders.
- The `prdFiles` array lists PRD files in the feature directory (e.g. `["00-master-plan.md"]`).

Construct a JSON object matching the `CheckpointWriteInput` schema:

```json
{
  "branch": "<from git state>",
  "lastCommit": "<from git state>",
  "uncommittedChanges": <true|false>,
  "prdFiles": ["00-master-plan.md"],
  "context": "## Context\n\n**Goal**: ...\n**Current phase**: ...\n**Key completions**: ...",
  "currentState": "## Current Progress\n\n- ✅ Phase 1: ...\n- ⬜ Phase 2: ...",
  "nextAction": "## Next Steps\n\n1. First task\n2. Second task",
  "keyFiles": "## Key Files\n\n- Master PRD: path\n- Key file: path",
  "decisions": ["Decision 1", "Decision 2"],
  "blockers": ["Blocker 1"],
  "notes": ["Note 1"],
  "continuationPrompt": "Please continue with ..."
}
```

The LLM **composes** the content (decisions, blockers, context — this requires judgment). The **CLI** handles YAML frontmatter, XML section formatting, file writing, and session-log appending. Do **not** format as markdown or write YAML frontmatter manually.

Reference the [checkpoint-template.md](references/checkpoint-template.md) for the *semantic structure* of each section, but let the CLI handle the formatting.

### Step 8: Save Checkpoint via CLI

Check if `$PROJECT_ROOT/.dev/$FEATURE_NAME/checkpoint.md` already exists. Remember whether the file existed as `$IS_FIRST_CHECKPOINT` (true if the file did NOT exist, false if it did).

**Use `--input-file`, not `echo | --stdin`.** Multi-line JSON string values (the `context`, `currentState`, etc. sections contain `\n`) cannot be piped reliably through `echo '...'` — unescaped literal newlines in the shell become real U+000A bytes inside JSON string literals and `JSON.parse` rejects them as "Bad control character". Write the JSON to a file, then pass the path to the CLI.

1. **Write** the Step 7 JSON to `$FEATURE_DIR/.checkpoint-input.json` using the `Write` tool. The file can contain real newlines — `Write` is not a shell and does not mangle the content.
2. **Run** the CLI against that file:

   ```bash
   node "$CLI" checkpoint-write --dir "$FEATURE_DIR" --input-file "$FEATURE_DIR/.checkpoint-input.json"
   ```

3. **Delete** the input file once the CLI reports success:

   ```bash
   rm -f "$FEATURE_DIR/.checkpoint-input.json"
   ```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). `$FEATURE_DIR` is `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

The CLI will:
1. **Read the existing `checkpoint.md`** (if it exists) and append it to `session-log.md` as a session entry
2. **Write the new `checkpoint.md`** with proper YAML frontmatter and XML section formatting
3. **Return** `{ success, file }` confirming the write

**Check the exit code.** A non-zero exit code means the command failed (e.g., invalid JSON, missing required fields, directory not found). **Never ignore a non-zero exit** — if `checkpoint-write` fails, stop and report the error. The checkpoint was NOT saved, and `.checkpoint-input.json` is left on disk for inspection (do not delete it on failure).

**Do NOT manually write `checkpoint.md` or `session-log.md`** — the CLI ensures format compatibility and handles session-log accumulation automatically.

### Step 9: Summary

Report:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- What the next steps are
- Confirm the checkpoint location

### Step 10: Workflow Setup (First Checkpoint Only)

> **REQUIRED CHECK**: Evaluate `$IS_FIRST_CHECKPOINT` (set in Step 8).
> - If `$IS_FIRST_CHECKPOINT` is **true** (this is a NEW checkpoint — no checkpoint.md existed before Step 8): **execute this step**.
> - If `$IS_FIRST_CHECKPOINT` is **false** (checkpoint.md already existed): skip to Step 11.

This step offers the user a worktree or branch for the feature. Follow the instructions in [worktree-guide.md](references/worktree-guide.md).

Use `$WORKTREE` as the absolute path to `scripts/worktree-setup.sh` within this skill's directory. Apply the path safety rules from Step 0.

### Step 11: Optional Commit

**Skip this step entirely** if ANY of these are true:
- This is not a git repository
- `git status --porcelain` output is empty (no uncommitted changes)

Note: Run `git status --porcelain` fresh here — do NOT reuse Step 5's result, because Step 9.5 may have moved files.

If there are uncommitted changes, generate a commit message from the checkpoint context:
- Format: `<Summary of what was accomplished this session>`
- Derive the summary from the checkpoint's `<context>` and `<current_state>` sections
- Keep it to one concise sentence (under 72 characters if possible)

**STOP.** Present the following to the user and wait for their response:

> Ready to commit your changes:
>
> ```
> <output of `git status --short`>
> ```
>
> Proposed commit message:
> ```
> <generated commit message>
> ```
>
> Commit these changes?

**If the user declines**: End the skill normally — no further action.

**If the user accepts**, run:

```bash
git add -u
# If there are user-approved untracked files from `git status --short`, add them explicitly:
# git add -- "<path>"
git commit -m "<generated commit message>"
```

Confirm with `git log -1 --oneline` and report the commit hash.

### Wrap-Up Suggestion

After the checkpoint is complete (whether or not a commit was made), suggest:

> Before ending your session, consider running `/dev-wrapup` to review learnings worth persisting and identify self-improvement signals.
