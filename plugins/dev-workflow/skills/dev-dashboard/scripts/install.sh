#!/usr/bin/env bash
# Install user-local shims for the bundled dev-dashboard scripts.
#
# Usage: bash install.sh
#   Creates or updates shims in the selected user-local bin directory.
#
# Output:
#   installed:<bin-dir>  — shims created or updated
#   path_warning:<bin-dir> — install succeeded but bin dir is not on PATH
#   error:<message>      — install failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
START_SCRIPT="$SCRIPT_DIR/start.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop.sh"

DEFAULT_BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
BIN_DIR="${DEV_DASHBOARD_BIN_DIR:-$DEFAULT_BIN_DIR}"
START_SHIM="$BIN_DIR/dev-dashboard"
STOP_SHIM="$BIN_DIR/dev-dashboard-stop"

if [ ! -f "$START_SCRIPT" ]; then
  echo "error:Start script not found at $START_SCRIPT"
  exit 1
fi

if [ ! -f "$STOP_SCRIPT" ]; then
  echo "error:Stop script not found at $STOP_SCRIPT"
  exit 1
fi

mkdir -p "$BIN_DIR"

write_shim() {
  local target_path="$1"
  local shim_path="$2"
  local extra_args="$3"
  local tmp_path

  tmp_path="$(mktemp "${TMPDIR:-/tmp}/dev-dashboard-shim.XXXXXX")"
  cat >"$tmp_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bash "$target_path"$extra_args "\$@"
EOF
  chmod +x "$tmp_path"
  mv "$tmp_path" "$shim_path"
}

write_shim "$START_SCRIPT" "$START_SHIM" ' --open'
write_shim "$STOP_SCRIPT" "$STOP_SHIM" ''

echo "installed:${BIN_DIR}"

case ":${PATH:-}:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "path_warning:${BIN_DIR}"
    ;;
esac
