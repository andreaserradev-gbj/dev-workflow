#!/usr/bin/env bash
# Report whether dev-dashboard command shims are installed and usable.
#
# Usage: bash check-install.sh
#
# Output:
#   status:<installed|missing|stale>
#   bin_dir:<path>
#   on_path:<true|false>
#   start_shim:<path>
#   stop_shim:<path>
#   error:<message>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
START_SCRIPT="$SCRIPT_DIR/start.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop.sh"

DEFAULT_BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
BIN_DIR="${DEV_DASHBOARD_BIN_DIR:-$DEFAULT_BIN_DIR}"
START_SHIM="$BIN_DIR/dev-dashboard"
STOP_SHIM="$BIN_DIR/dev-dashboard-stop"

expected_shim_body() {
  local target_path="$1"
  local extra_args="$2"
  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bash "$target_path"$extra_args "\$@"
EOF
}

matches_expected() {
  local shim_path="$1"
  local target_path="$2"
  local extra_args="$3"

  [ -f "$shim_path" ] || return 1
  [ -x "$shim_path" ] || return 1

  local expected
  expected="$(expected_shim_body "$target_path" "$extra_args")"
  local actual
  actual="$(cat "$shim_path")"

  [ "$actual" = "$expected" ]
}

path_contains_bin_dir=false
case ":${PATH:-}:" in
  *":$BIN_DIR:"*) path_contains_bin_dir=true ;;
esac

status="installed"
start_matches=true
stop_matches=true

if ! matches_expected "$START_SHIM" "$START_SCRIPT" ' --open'; then
  start_matches=false
fi

if ! matches_expected "$STOP_SHIM" "$STOP_SCRIPT" ''; then
  stop_matches=false
fi

if [ "$start_matches" = "false" ] && [ "$stop_matches" = "false" ]; then
  if [ -e "$START_SHIM" ] || [ -e "$STOP_SHIM" ]; then
    status="stale"
  else
    status="missing"
  fi
elif [ "$start_matches" = "false" ] || [ "$stop_matches" = "false" ]; then
  status="stale"
fi

echo "status:${status}"
echo "bin_dir:${BIN_DIR}"
echo "on_path:${path_contains_bin_dir}"
echo "start_shim:${START_SHIM}"
echo "stop_shim:${STOP_SHIM}"
