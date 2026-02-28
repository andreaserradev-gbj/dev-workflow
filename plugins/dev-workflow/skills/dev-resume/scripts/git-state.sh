#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "git:false"
  exit 0
fi

case "$MODE" in
  brief)
    # Usage: git-state.sh brief
    # stdout: branch:<name> and uncommitted:<true|false>
    BRANCH="$(git branch --show-current)"
    PORCELAIN="$(git status --porcelain)"
    echo "branch:${BRANCH}"
    if [ -n "$PORCELAIN" ]; then
      echo "uncommitted:true"
    else
      echo "uncommitted:false"
    fi
    ;;

  full)
    # Usage: git-state.sh full
    # stdout: branch:<name>, commit:<oneline>, status:<lines>
    BRANCH="$(git branch --show-current)"
    COMMIT="$(git log --oneline -1 2>/dev/null || echo "(no commits)")"
    echo "branch:${BRANCH}"
    echo "commit:${COMMIT}"
    git status --short | while IFS= read -r line; do
      echo "status:${line}"
    done
    ;;

  *)
    echo "Usage: git-state.sh {brief|full}" >&2
    exit 1
    ;;
esac
