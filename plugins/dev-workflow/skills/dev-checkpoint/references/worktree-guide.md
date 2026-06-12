# Workflow Setup Guide

Instructions for offering and executing worktree or branch setup during first checkpoint (Step 6).

## Check Eligibility

Run the worktree script:

```bash
bash "$WORKTREE" check "$FEATURE_NAME" "$PROJECT_ROOT"
```

Where `$WORKTREE` is the absolute path to `scripts/worktree-setup.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output).

The branch argument is omitted: in the commit-first order git state is not captured until Step 9, so no `$BRANCH` is available yet. The script falls back to `git branch --show-current` to decide eligibility.

- If output starts with `skip:` → skip this step entirely.
- If output is `offer` → present the offer below.

## Offer Workflow Setup

Present the following to the user and wait for their response:

> Would you like to set up a dedicated workflow for `$FEATURE_NAME`?
>
> 1. **Worktree** — Creates branch `feature/$FEATURE_NAME` with a worktree in `../<project-basename>-$FEATURE_NAME/`. Keeps main available in the original directory for parallel work.
> 2. **Branch** — Creates and switches to branch `feature/$FEATURE_NAME` in the current directory.
> 3. **Skip** — Stay on the current branch.

**If the user chooses Skip or declines**: continue to Step 7 on the current branch — no further setup.

## Execute Worktree Setup

If the user chooses **Worktree**:

```bash
bash "$WORKTREE" execute "$FEATURE_NAME" "$PROJECT_ROOT"
```

Parse output: `worktree:<path>` gives the worktree location. Capture it as `$WORKTREE_PATH`.

This **moves** `$PROJECT_ROOT/.dev/$FEATURE_NAME` into the worktree. Back in Step 6, retarget `$PROJECT_ROOT` and `$FEATURE_DIR` to the worktree so the commit, PRD updates, git-state capture, and checkpoint write all land there.

### Acknowledge (Worktree)

Confirm setup, but do **not** tell the user to leave yet — the checkpoint has not been written:

> Worktree setup complete.
>
> - Branch: `feature/$FEATURE_NAME`
> - Worktree: `<path from output>`
> - PRD files moved and committed
>
> Continuing the checkpoint inside the worktree. The restart instruction comes at the end.

The "end this session and `cd` into the worktree" instruction is reported in the **Step 12 summary**, after `checkpoint.md` has been written into the worktree.

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
> You are now on the feature branch. Continuing the checkpoint here — the commit (Step 7) lands on this branch.
