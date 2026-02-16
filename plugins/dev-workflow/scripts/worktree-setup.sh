#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
shift || true

case "$MODE" in
  check)
    # Usage: worktree-setup.sh check <feature> <root> <branch>
    # stdout: "offer" or "skip:<reason>"
    FEATURE="${1:?feature required}"
    ROOT="${2:?root required}"
    BRANCH="${3:-}"

    if ! git rev-parse --git-dir >/dev/null 2>&1; then
      echo "skip:not-a-git-repo"; exit 0
    fi

    # Use git if branch not provided
    if [ -z "$BRANCH" ]; then
      BRANCH="$(git branch --show-current)"
    fi

    if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
      echo "skip:not-default-branch"; exit 0
    fi

    if [ -n "$(git branch --list "feature/$FEATURE")" ]; then
      echo "skip:branch-exists"; exit 0
    fi

    echo "offer"
    ;;

  execute)
    # Usage: worktree-setup.sh execute <feature> <root>
    # stdout: worktree:<path> on success
    FEATURE="${1:?feature required}"
    ROOT="${2:?root required}"
    BASENAME="$(basename "$ROOT")"
    WORKTREE="$ROOT/../$BASENAME-$FEATURE"

    # 1. Create branch + worktree
    git worktree add -b "feature/$FEATURE" "$WORKTREE"

    # 2. Move PRD files
    mkdir -p "$WORKTREE/.dev"
    mv "$ROOT/.dev/$FEATURE" "$WORKTREE/.dev/$FEATURE"

    # 3. Commit in worktree
    git -C "$WORKTREE" add .dev
    git -C "$WORKTREE" commit -m "Add PRD for $FEATURE"

    # 4. Update checkpoint frontmatter
    CHECKPOINT="$WORKTREE/.dev/$FEATURE/checkpoint.md"
    if [ -f "$CHECKPOINT" ]; then
      sed -i '' -e 's/^branch: main$/branch: feature\/'"$FEATURE"'/' \
                -e 's/^branch: master$/branch: feature\/'"$FEATURE"'/' \
                -e 's/^uncommitted_changes: true$/uncommitted_changes: false/' \
                "$CHECKPOINT"

      # 5. Amend commit with updated checkpoint
      git -C "$WORKTREE" add .dev
      git -C "$WORKTREE" commit --amend --no-edit
    fi

    echo "worktree:$WORKTREE"
    ;;

  *)
    echo "Usage: worktree-setup.sh {check|execute} ..." >&2
    exit 1
    ;;
esac
