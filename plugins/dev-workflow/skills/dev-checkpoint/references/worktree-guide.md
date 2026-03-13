# Workflow Setup Guide

Instructions for offering and executing worktree or branch setup during first checkpoint.

## Check Eligibility

Run the worktree script:

```bash
bash "$WORKTREE" check "$FEATURE_NAME" "$PROJECT_ROOT" "$BRANCH"
```

Where `$WORKTREE` is the absolute path to `scripts/worktree-setup.sh` within this skill's directory. `$BRANCH` is the branch from Step 5 (or empty if not a git repo). Apply the path safety rules from Step 0 (`$HOME`, copy from output).

- If output starts with `skip:` → skip this step entirely.
- If output is `offer` → present the offer below.

## Offer Workflow Setup

Present the following to the user and wait for their response:

> Would you like to set up a dedicated workflow for `$FEATURE_NAME`?
>
> 1. **Worktree** — Creates branch `feature/$FEATURE_NAME` with a worktree in `../<project-basename>-$FEATURE_NAME/`. Keeps main available in the original directory for parallel work.
> 2. **Branch** — Creates and switches to branch `feature/$FEATURE_NAME` in the current directory.
> 3. **Skip** — Stay on the current branch.

**If the user chooses Skip or declines**: End the skill normally — no further action.

## Execute Worktree Setup

If the user chooses **Worktree**:

```bash
bash "$WORKTREE" execute "$FEATURE_NAME" "$PROJECT_ROOT"
```

Parse output: `worktree:<path>` gives the worktree location.

### Report (Worktree)

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

## Execute Branch Setup

If the user chooses **Branch**:

```bash
bash "$WORKTREE" branch "$FEATURE_NAME" "$PROJECT_ROOT"
```

Parse output: `branch:<name>` gives the branch name.

### Report (Branch)

> Branch setup complete.
>
> - Branch: `<name from output>`
>
> You are now on the feature branch. Continue working in the current directory.
