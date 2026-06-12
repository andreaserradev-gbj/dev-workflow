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
- If the user mentions bugs during confirmation (Step 4), note them in `<blockers>` or `<notes>` but do NOT attempt to fix them

### Why commit-first ordering

The branch/worktree decision and the optional commit happen **before** PRD markers are updated and the checkpoint is written. This way the saved checkpoint records the branch and commit the session actually ends on — a branch created *after* the checkpoint would make the next `/dev-resume` report `drifted`. The PRD-marker edits and `checkpoint.md`/`session-log.md` written after the commit are honestly recorded as `uncommittedChanges: true`; they get swept into the next session's commit.

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

Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`. The checkpoint will be saved to `$FEATURE_DIR/checkpoint.md`. (If a worktree is set up in Step 6, both `$PROJECT_ROOT` and `$FEATURE_DIR` are retargeted there.)

### Step 2: Gather Feature State via CLI

Run the CLI to get structured progress and gate data:

```bash
node "$CLI" progress-summary --json --dir "$FEATURE_DIR"
```

```bash
node "$CLI" gate-check --json --dir "$FEATURE_DIR"
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

### Step 4: Confirm Session Context

Present the agent's findings (decisions, blockers, notes) and end with an explicit question:

> "Does this look right? Reply **yes** to continue, or tell me what to add or change."

If a category is empty, omit it.

The **completed items** and **current phase** confirmed here anchor the commit message composed in Step 7 — note them.

**STOP. Wait for explicit confirmation before proceeding to Step 5. If the user mentions new bugs or issues during this step, add them to the checkpoint notes — do NOT investigate or fix them.**

### Step 5: Determine First-Checkpoint Status

Check whether `$FEATURE_DIR/checkpoint.md` already exists. Set `$IS_FIRST_CHECKPOINT` to **true** if the file does NOT exist, **false** if it does.

This must be evaluated **now**, before any branch/worktree setup or checkpoint write — later steps create `checkpoint.md` (and, for a worktree, move the feature directory), so the existence check is only meaningful before they run.

### Step 6: Workflow Setup (First Checkpoint Only)

> **REQUIRED CHECK**: Evaluate `$IS_FIRST_CHECKPOINT` (set in Step 5).
> - If `$IS_FIRST_CHECKPOINT` is **true** (no `checkpoint.md` existed): **execute this step**.
> - If `$IS_FIRST_CHECKPOINT` is **false** (a checkpoint already exists): skip to Step 7.

This step offers the user a worktree or branch for the feature. Follow the instructions in [worktree-guide.md](references/worktree-guide.md).

Use `$WORKTREE` as the absolute path to `scripts/worktree-setup.sh` within this skill's directory. Apply the path safety rules from Step 0.

The branch/worktree offer runs **before** the commit (Step 7) so the commit lands on the new branch or worktree.

**If the user chooses Worktree** — the worktree is created before `checkpoint.md` exists, and `worktree-setup.sh execute` *moves* `$PROJECT_ROOT/.dev/$FEATURE_NAME` into the worktree. So you must retarget every subsequent path:

1. Run `worktree-setup.sh execute` per the guide; capture the worktree location from its `worktree:<path>` output as `$WORKTREE_PATH`.
2. **Retarget**: set `$PROJECT_ROOT ← $WORKTREE_PATH` and `$FEATURE_DIR ← $WORKTREE_PATH/.dev/$FEATURE_NAME`. Every later step — the commit (7), PRD updates (8), git-state capture (9), and checkpoint write (11) — operates on the worktree. Run git against it (`git -C "$WORKTREE_PATH" …`) and run cwd-based scripts from it (`cd "$WORKTREE_PATH" && …`).
3. **Defer the restart instruction**: do NOT yet tell the user to end the session and `cd` into the worktree. The checkpoint must be written first. That instruction is reported in the Step 12 summary.

**If the user chooses Branch** — `worktree-setup.sh branch` creates and switches to `feature/$FEATURE_NAME` in the current directory. No retargeting needed: the commit (7) lands on it and Step 9 records it.

**If the user chooses Skip or declines** — stay on the current branch and continue to Step 7.

### Step 7: Optional Commit

**Skip this step entirely** if ANY of these are true:
- This is not a git repository
- A fresh `git status --porcelain` is empty (no uncommitted changes)

Run `git status --porcelain` fresh here (in the worktree case, `git -C "$WORKTREE_PATH" status --porcelain`) — do NOT reuse any earlier result.

If there are uncommitted changes, generate a commit message from the **Step 3 session analysis as confirmed in Step 4** (completed items + current phase):
- Format: `<Summary of what was accomplished this session>`
- One concise sentence, under 72 characters if possible
- Per repo conventions: no AI attribution, no emojis

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

**If the user declines**: leave the working tree as-is and continue to Step 8 — the checkpoint is still saved (it will record the uncommitted state).

**If the user accepts**, run (prefix git with `-C "$WORKTREE_PATH"` in the worktree case):

```bash
git add -u
# If there are user-approved untracked files from `git status --short`, add them explicitly:
# git add -- "<path>"
git commit -m "<generated commit message>"
```

Confirm with `git log -1 --oneline` and report the commit hash. Then continue to Step 8.

### Step 8: Update PRD Status Markers (REQUIRED)

For each completed item identified in Step 3, run the CLI:

```bash
node "$CLI" status-update --phase N --step M --marker done --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). `$FEATURE_DIR` is `$PROJECT_ROOT/.dev/$FEATURE_NAME` (retargeted to the worktree if Step 6 set one up).

- `--phase N` — the phase number containing the completed step
- `--step M` — the step number within that phase (omit for phase-level markers)
- `--marker done` — marks the step as ✅ complete

The CLI reports `{ changed, line, file }` as JSON when `--json` is passed, or a text summary otherwise. Track these results for the Step 12 summary. If `changed` is false, the marker was already ✅.

**Check the exit code.** A non-zero exit code means the command failed (e.g., phase not found, invalid path). **Never ignore a non-zero exit** — if a `status-update` call fails, stop and report the error before continuing.

If nothing was completed, state: "No PRD updates needed."

**Do NOT manually edit PRD files** — the `status-update` CLI ensures format compatibility with the parser.

### Step 9: Capture Git State

Run the [git state script](scripts/git-state.sh):

```bash
bash "$GIT_STATE" full
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

This runs **after** the commit (Step 7) and the PRD-marker updates (Step 8), so `branch` and `lastCommit` reflect the final state and the `status:` lines correctly show the fresh `.dev/` edits as uncommitted.

`git-state.sh` reads the current working directory. **In the worktree case**, run it from the worktree so it reports the worktree's state: `cd "$WORKTREE_PATH" && bash "$GIT_STATE" full`.

Parse the output lines:
- `git:false` → not a git repo; omit `branch`, `lastCommit`, `uncommittedChanges` from the checkpoint JSON.
- `branch:<name>` → store for checkpoint JSON `branch` field
- `commit:<oneline>` → store as checkpoint JSON `lastCommit` field
- `status:<line>` → each is one line of `git status --short`; if no `status:` lines, set `uncommittedChanges` to `false` (otherwise `true`)

### Step 10: Compose Checkpoint Data

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

### Step 11: Save Checkpoint via CLI

**Use `--input-file`, not `echo | --stdin`.** Multi-line JSON string values (the `context`, `currentState`, etc. sections contain `\n`) cannot be piped reliably through `echo '...'` — unescaped literal newlines in the shell become real U+000A bytes inside JSON string literals and `JSON.parse` rejects them as "Bad control character". Write the JSON to a file, then pass the path to the CLI.

1. **Write** the Step 10 JSON to `$FEATURE_DIR/.checkpoint-input.json` using the `Write` tool. The file can contain real newlines — `Write` is not a shell and does not mangle the content.
2. **Run** the CLI against that file:

   ```bash
   node "$CLI" checkpoint-write --dir "$FEATURE_DIR" --input-file "$FEATURE_DIR/.checkpoint-input.json"
   ```

3. **Delete** the input file once the CLI reports success:

   ```bash
   rm -f "$FEATURE_DIR/.checkpoint-input.json"
   ```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). `$FEATURE_DIR` is `$PROJECT_ROOT/.dev/$FEATURE_NAME` (the worktree path if Step 6 set one up).

The CLI will:
1. **Read the existing `checkpoint.md`** (if it exists) and append it to `session-log.md` as a session entry
2. **Write the new `checkpoint.md`** with proper YAML frontmatter and XML section formatting
3. **Return** `{ success, file }` confirming the write

**Check the exit code.** A non-zero exit code means the command failed (e.g., invalid JSON, missing required fields, directory not found). **Never ignore a non-zero exit** — if `checkpoint-write` fails, stop and report the error. The checkpoint was NOT saved, and `.checkpoint-input.json` is left on disk for inspection (do not delete it on failure).

**Do NOT manually write `checkpoint.md` or `session-log.md`** — the CLI ensures format compatibility and handles session-log accumulation automatically.

### Step 12: Summary

Report:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- Whether a commit was made (and its hash), or that the commit was skipped/declined
- What the next steps are
- Confirm the checkpoint location

**If a worktree was set up in Step 6**, end the summary with the deferred restart instruction:

> Worktree ready at `<$WORKTREE_PATH>` on branch `feature/$FEATURE_NAME`, and this checkpoint was saved inside it.
>
> **Next**: End this session, then start a new one in the worktree:
> ```
> cd "<$WORKTREE_PATH>" && claude
> ```

### Wrap-Up Suggestion

After the checkpoint is complete (whether or not a commit was made), suggest:

> Before ending your session, consider running `/dev-wrapup` to review learnings worth persisting and identify self-improvement signals.
