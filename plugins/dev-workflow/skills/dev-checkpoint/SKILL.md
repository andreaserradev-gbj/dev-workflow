---
name: dev-checkpoint
description: >-
  Save progress and generate a continuation prompt.
  Updates PRD status markers, captures git state,
  and writes checkpoint.md for the next session.
  Use at the end of a session or before switching context.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Bash(git add:*) Bash(git commit:*) Bash(git log:*) Bash(git status:*) Read
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

### Step 2: Analyze Session with Agent

Launch the **checkpoint-analyzer agent** to scan PRD files and the current session:

```
"Analyze the PRD files in $PROJECT_ROOT/.dev/$FEATURE_NAME/ and the current session.
Find: completed items (⬜ → ✅), pending items, decisions made, blockers encountered.
Determine current phase and next step."
```

Use `subagent_type=dev-workflow:checkpoint-analyzer` and `model=haiku`.

### Step 3: Review Agent Findings

After the agent returns:

1. **Verify accuracy** — Check that completed/pending items match what happened
2. **Add missing context** — Include any decisions or blockers the agent missed

### Step 4: Update PRD Status Markers (REQUIRED)

For each PRD file in `.dev/$FEATURE_NAME/`:
1. Read the file
2. Change `⬜` to `✅` for completed items; update "Status" fields
3. Save changes

Track what was updated (file + markers changed) — reported in Step 9.

If nothing was completed, state: "No PRD updates needed."

### Step 5: Capture Git State

Run the [git state script](scripts/git-state.sh):

```bash
bash "$GIT_STATE" full
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

Parse the output lines:
- `git:false` → not a git repo; omit `branch`, `last_commit`, `uncommitted_changes` from frontmatter.
- `branch:<name>` → store for frontmatter
- `commit:<oneline>` → store as last commit
- `status:<line>` → each is one line of `git status --short`; if no `status:` lines, working tree is clean

### Step 6: Confirm Session Context

Present the agent's findings (decisions, blockers, notes) and end with an explicit question:

> "Does this look right? Reply **yes** to continue, or tell me what to add or change."

If a category is empty, omit it.

**STOP. Wait for explicit confirmation before proceeding to Step 7. If the user mentions new bugs or issues during this step, add them to the checkpoint notes — do NOT investigate or fix them.**

### Step 7: Generate Continuation Prompt

**Rules**:
- Always include `<context>`, `<current_state>`, `<next_action>`, `<key_files>`. Omit `<decisions>`, `<blockers>`, `<notes>` if empty.
- No absolute paths with usernames → use relative paths. No secrets/credentials → use placeholders.

Create a continuation prompt following the template in [checkpoint-template.md](references/checkpoint-template.md).

### Step 8: Save Checkpoint

Check if `$PROJECT_ROOT/.dev/$FEATURE_NAME/checkpoint.md` already exists. Remember whether the file existed as `$IS_FIRST_CHECKPOINT` (true if the file did NOT exist, false if it did).

If it exists, read it first (the Write tool requires reading before overwriting). Then write the continuation prompt to that path.

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
