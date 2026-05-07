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
#   workflow_status:<installed|missing|stale|conflict>
#   workflow_shim:<path>
#   workflow_target:<path>
#   workflow_conflict:<path>            # only when status is conflict
#   error:<message>
#
# The top-level status line describes only the dashboard start/stop shims, so an
# unrelated `dev-workflow` command on PATH does not make `/dev-dashboard`
# unavailable. Workflow shim state is reported via the `workflow_*` lines.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
START_SCRIPT="$SCRIPT_DIR/start.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop.sh"
CLI_TARGET="$(cd "$SCRIPT_DIR/../../../bin" && pwd)/dev-workflow.cjs"

DEFAULT_BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
BIN_DIR="${DEV_DASHBOARD_BIN_DIR:-$DEFAULT_BIN_DIR}"
START_SHIM="$BIN_DIR/dev-dashboard"
STOP_SHIM="$BIN_DIR/dev-dashboard-stop"
WORKFLOW_SHIM="$BIN_DIR/dev-workflow"

expected_shim_body() {
  local target_path="$1"
  local extra_args="$2"
  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bash "$target_path"$extra_args "\$@"
EOF
}

expected_workflow_shim_body() {
  local target_path="$1"
  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "$target_path" "\$@"
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

matches_expected_workflow() {
  local shim_path="$1"
  local target_path="$2"

  [ -f "$shim_path" ] || return 1
  [ -x "$shim_path" ] || return 1

  local expected
  expected="$(expected_workflow_shim_body "$target_path")"
  local actual
  actual="$(cat "$shim_path")"

  [ "$actual" = "$expected" ]
}

workflow_is_managed() {
  local shim_path="$1"
  local target_path="$2"

  [ -f "$shim_path" ] || return 1

  grep -Fq "exec node \"$target_path\"" "$shim_path" && return 0
  grep -Fq '/plugins/dev-workflow/bin/dev-workflow.cjs' "$shim_path" && return 0

  return 1
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

workflow_status="installed"
workflow_conflict=""

if [ ! -e "$WORKFLOW_SHIM" ]; then
  workflow_status="missing"
elif matches_expected_workflow "$WORKFLOW_SHIM" "$CLI_TARGET"; then
  workflow_status="installed"
elif workflow_is_managed "$WORKFLOW_SHIM" "$CLI_TARGET"; then
  workflow_status="stale"
else
  workflow_status="conflict"
  workflow_conflict="$WORKFLOW_SHIM"
fi

echo "status:${status}"
echo "bin_dir:${BIN_DIR}"
echo "on_path:${path_contains_bin_dir}"
echo "start_shim:${START_SHIM}"
echo "stop_shim:${STOP_SHIM}"
echo "workflow_status:${workflow_status}"
echo "workflow_shim:${WORKFLOW_SHIM}"
echo "workflow_target:${CLI_TARGET}"
if [ -n "$workflow_conflict" ]; then
  echo "workflow_conflict:${workflow_conflict}"
fi
