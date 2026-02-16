---
name: dev-checkpoint
description: >-
  Save progress and generate a continuation prompt.
  Updates PRD status markers, captures git state,
  and writes checkpoint.md for the next session.
argument-hint: <feature name>
allowed-tools: Bash(git rev-parse:*) Bash(git branch:*) Bash(git log:*) Bash(git status:*) Bash(git worktree:*) Bash(git add:*) Bash(git commit:*) Bash(mv:*) Bash(mkdir:*) Bash(find:*) Bash(grep:*) Bash(basename:*) Bash(printf:*) Bash(test:*) Bash(tr:*) Bash(sed:*) Read
---

## Checkpoint Current Session

Review the current session and create a continuation prompt for the next session.

### SAVE-ONLY MODE

This skill analyzes and saves. It does NOT fix, investigate, or implement anything.

- Do NOT investigate bugs or errors mentioned during the session
- Do NOT start implementing fixes or next steps
- Do NOT move to the next phase or task
- If the user mentions bugs during confirmation (Step 6), note them in `<blockers>` or `<notes>` but do NOT attempt to fix them

### Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this skill.

### Step 1: Identify the Active Feature

First, check if a `$PROJECT_ROOT/.dev/` directory exists. If it does not exist, ask the user to specify the feature name and create the `$PROJECT_ROOT/.dev/<safe-feature-slug>/` directory before proceeding.

If `$PROJECT_ROOT/.dev/` exists, find all available features:

```bash
FEATURE_DIRS="$(find "$PROJECT_ROOT/.dev" -maxdepth 1 -type d ! -name .dev | sort)"
printf '%s\n' "$FEATURE_DIRS"
```

**If an argument was provided** (`$ARGUMENTS`):
- Filter the discovered feature list with a fixed-string, case-insensitive match:
  ```bash
  MATCHES="$(printf '%s\n' "$FEATURE_DIRS" | grep -iF -- "$ARGUMENTS" || true)"
  ```
- If exactly one match: use that feature path as `$FEATURE_PATH`
- If multiple matches: ask which of the matching features to checkpoint
- If no matches: inform the user that no features match "$ARGUMENTS" and list all available features

**If no argument was provided**:
- If multiple features exist: ask "Which feature would you like to checkpoint?" and list the available features
- If only one feature exists: use that feature path as `$FEATURE_PATH`
- If no features exist: ask the user to specify the feature name

Set `$FEATURE_NAME` before continuing:
- If using an existing feature, derive it from the selected discovered path:
  ```bash
  FEATURE_NAME="$(basename "$FEATURE_PATH")"
  ```
- If creating a new feature, normalize user input into a safe slug:
  ```bash
  FEATURE_NAME="$(printf '%s' "$USER_INPUT" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  ```
- Never use raw `$ARGUMENTS` directly in shell commands or paths.

Enforce with shell checks before path use:

```bash
if [ -n "${FEATURE_PATH:-}" ]; then
  case "$FEATURE_PATH" in
    *".."*) echo "Invalid feature path (traversal): $FEATURE_PATH"; exit 1 ;;
    "$PROJECT_ROOT/.dev/"*) ;;
    *) echo "Invalid feature path: $FEATURE_PATH"; exit 1 ;;
  esac
fi
printf '%s' "$FEATURE_NAME" | grep -Eq '^[a-z0-9][a-z0-9-]*$' \
  || { echo "Invalid feature name slug: $FEATURE_NAME"; exit 1; }
```

**If any of the above checks exit non-zero, STOP immediately. Report the validation error to the user and do not proceed to any subsequent step.**

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

If git repo, run these as **separate** Bash calls (do NOT combine with `&&`):

1. `git branch --show-current`
2. `git log --oneline -1`
3. `git status --short`

Store results for checkpoint frontmatter.

If not a git repo, skip and omit `branch`, `last_commit`, `uncommitted_changes` from frontmatter.

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

**Skip this step entirely** if ANY of these are true:
- This is not a git repository
- The current branch (from Step 5) is NOT `main` or `master`
- `git branch --list "feature/$FEATURE_NAME"` returns a non-empty result (branch already exists)

If all conditions pass, this is a first-time checkpoint on the default branch — offer worktree setup.

**STOP.** Present the following to the user and wait for their response:

> Would you like to set up a worktree-based workflow for `$FEATURE_NAME`?
>
> This will:
> 1. Create branch `feature/$FEATURE_NAME` with a worktree in `../<project-basename>-$FEATURE_NAME/`
> 2. Move `.dev/$FEATURE_NAME/` to the worktree
> 3. Commit the PRD files in the new worktree
>
> After setup, you should **end this session** and start a new one from the worktree directory.

**If the user declines**: End the skill normally — no further action.

**If the user accepts**, run these commands:

Derive `$PROJECT_BASENAME` from `$PROJECT_ROOT` (the directory name, e.g. `basename "$PROJECT_ROOT"`).

1. **Create branch + worktree**:
   ```bash
   git worktree add -b "feature/$FEATURE_NAME" "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME"
   ```

2. **Move PRD files**:
   ```bash
   mkdir -p "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME/.dev"
   mv "$PROJECT_ROOT/.dev/$FEATURE_NAME" "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME/.dev/$FEATURE_NAME"
   ```

3. **Commit in worktree**:
   ```bash
   git -C "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME" add .dev
   git -C "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME" commit -m "Add PRD for $FEATURE_NAME"
   ```

4. **Update checkpoint frontmatter**: The checkpoint was written in Step 8 with the original branch (e.g. `main`). Now that the files live in the worktree on `feature/$FEATURE_NAME`, update the frontmatter so `/dev-resume` doesn't flag a branch mismatch:
   - In `$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME/.dev/$FEATURE_NAME/checkpoint.md`, change `branch: main` (or `master`) to `branch: feature/$FEATURE_NAME`
   - Change `uncommitted_changes: true` to `uncommitted_changes: false` (if present, since we just committed)
   - Amend the commit to include this update:
     ```bash
     git -C "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME" add .dev
     git -C "$PROJECT_ROOT/../$PROJECT_BASENAME-$FEATURE_NAME" commit --amend --no-edit
     ```

After successful execution, report:

> Worktree setup complete.
>
> - Branch: `feature/$FEATURE_NAME`
> - Worktree: `../<project-basename>-$FEATURE_NAME/`
> - PRD files moved and committed
>
> **Next**: End this session, then start a new one:
> ```
> cd "../$PROJECT_BASENAME-$FEATURE_NAME" && claude
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
