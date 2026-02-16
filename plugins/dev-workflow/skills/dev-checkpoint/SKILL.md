---
name: dev-checkpoint
description: >-
  Save progress and generate a continuation prompt.
  Updates PRD status markers, captures git state,
  and writes checkpoint.md for the next session.
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

Run the [discovery script](../../scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within the plugin directory. Inline actual values — do not rely on shell variables persisting between calls.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

### Step 1: Identify the Active Feature

Run the [discovery script](../../scripts/discover.sh) to find features:

```bash
bash "$DISCOVER" features "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): ask the user to specify the feature name.
- If output is empty: no features found, ask the user to specify the feature name.
- If one line: use as `$FEATURE_PATH`.
- If multiple lines: ask which feature to checkpoint.

Never use raw `$ARGUMENTS` directly in shell commands or paths.

Validate with the [validation script](../../scripts/validate.sh). Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within the plugin directory. Inline actual values.

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

Run the [git state script](../../scripts/git-state.sh):

```bash
bash "$GIT_STATE" full
```

Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within the plugin directory. Inline actual values.

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

Write the continuation prompt to `$PROJECT_ROOT/.dev/$FEATURE_NAME/checkpoint.md`. Create the file if it doesn't exist, or overwrite it completely if it does.

### Step 9: Summary

Report:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- What the next steps are
- Confirm the checkpoint location

### Step 9.5: Optional Worktree Setup (First Checkpoint Only)

Check whether to offer worktree setup using the [worktree script](../../scripts/worktree-setup.sh):

```bash
bash "$WORKTREE" check "$FEATURE_NAME" "$PROJECT_ROOT" "$BRANCH"
```

Where `$WORKTREE` is the absolute path to `scripts/worktree-setup.sh` within the plugin directory. `$BRANCH` is the branch from Step 5 (or empty if not a git repo). Inline actual values.

- If output starts with `skip:` → skip this step entirely.
- If output is `offer` → present the following to the user and wait for their response:

> Would you like to set up a worktree-based workflow for `$FEATURE_NAME`?
>
> This will:
> 1. Create branch `feature/$FEATURE_NAME` with a worktree in `../<project-basename>-$FEATURE_NAME/`
> 2. Move `.dev/$FEATURE_NAME/` to the worktree
> 3. Commit the PRD files in the new worktree
>
> After setup, you should **end this session** and start a new one from the worktree directory.

**If the user declines**: End the skill normally — no further action.

**If the user accepts**:

```bash
bash "$WORKTREE" execute "$FEATURE_NAME" "$PROJECT_ROOT"
```

Parse output: `worktree:<path>` gives the worktree location.

Report:

> Worktree setup complete.
>
> - Branch: `feature/$FEATURE_NAME`
> - Worktree: `<path from output>`
> - PRD files moved and committed
>
> **Next**: End this session, then start a new one:
> ```
> cd "<path from output>" && claude
> ```

### Step 10: Optional Commit

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
