#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
shift || true

case "$MODE" in
  checkpoint-path)
    # Usage: validate.sh checkpoint-path <path> <root>
    PATH_ARG="${1:?path required}" ROOT="${2:?root required}"
    case "$PATH_ARG" in *..*)
      echo "Invalid checkpoint path (traversal)" >&2; exit 1;; esac
    case "$PATH_ARG" in "$ROOT"/.dev/*)
      ;; *) echo "Invalid checkpoint path" >&2; exit 1;; esac
    FEATURE_DIR="$(dirname "$PATH_ARG")"
    NAME="$(basename "$FEATURE_DIR")"
    ;;

  feature-path)
    # Usage: validate.sh feature-path <path> <root>
    PATH_ARG="${1:?path required}" ROOT="${2:?root required}"
    case "$PATH_ARG" in *..*)
      echo "Invalid feature path (traversal)" >&2; exit 1;; esac
    case "$PATH_ARG" in "$ROOT"/.dev/*)
      ;; *) echo "Invalid feature path" >&2; exit 1;; esac
    NAME="$(basename "$PATH_ARG")"
    ;;

  normalize)
    # Usage: validate.sh normalize <input>
    INPUT="${1:?input required}"
    NAME="$(printf '%s' "$INPUT" | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
    ;;

  slug)
    # Usage: validate.sh slug <name>
    NAME="${1:?name required}"
    ;;

  *)
    echo "Usage: validate.sh {checkpoint-path|feature-path|normalize|slug} ..." >&2
    exit 1
    ;;
esac

# Validate the resulting slug
if ! printf '%s' "$NAME" | grep -qE '^[a-z0-9][a-z0-9-]*$'; then
  echo "Invalid feature name slug: $NAME" >&2
  exit 1
fi

printf '%s' "$NAME"
