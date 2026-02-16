#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
shift || true

case "$MODE" in
  root)
    # Usage: discover.sh root
    # stdout: project root path
    ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
    printf '%s' "$ROOT"
    ;;

  checkpoints)
    # Usage: discover.sh checkpoints <root> [filter]
    # stdout: matching checkpoint.md paths (one per line)
    ROOT="${1:?root required}"
    FILTER="${2:-}"
    if [ ! -d "$ROOT/.dev" ]; then
      echo "No .dev/ directory" >&2; exit 1
    fi
    PATHS="$(find "$ROOT/.dev" -name "checkpoint.md" -type f | sort)"
    if [ -z "$PATHS" ]; then exit 0; fi
    if [ -n "$FILTER" ]; then
      printf '%s\n' "$PATHS" | grep -iF -- "$FILTER" || true
    else
      printf '%s\n' "$PATHS"
    fi
    ;;

  features)
    # Usage: discover.sh features <root> [filter]
    # stdout: matching feature dir paths (one per line)
    ROOT="${1:?root required}"
    FILTER="${2:-}"
    if [ ! -d "$ROOT/.dev" ]; then
      echo "No .dev/ directory" >&2; exit 1
    fi
    PATHS="$(find "$ROOT/.dev" -maxdepth 1 -type d ! -name .dev | sort)"
    if [ -z "$PATHS" ]; then exit 0; fi
    if [ -n "$FILTER" ]; then
      printf '%s\n' "$PATHS" | grep -iF -- "$FILTER" || true
    else
      printf '%s\n' "$PATHS"
    fi
    ;;

  archived)
    # Usage: discover.sh archived <root>
    # stdout: archived feature dir paths (one per line, empty if none)
    ROOT="${1:?root required}"
    find "$ROOT/.dev-archive" -maxdepth 1 -type d ! -name .dev-archive 2>/dev/null | sort || true
    ;;

  status-reports)
    # Usage: discover.sh status-reports <root>
    # stdout: existing status-report-*.md file paths (one per line, empty if none)
    ROOT="${1:?root required}"
    find "$ROOT/.dev" -maxdepth 1 -name "status-report-*.md" -type f 2>/dev/null | sort || true
    ;;

  *)
    echo "Usage: discover.sh {root|checkpoints|features|archived|status-reports} ..." >&2
    exit 1
    ;;
esac
