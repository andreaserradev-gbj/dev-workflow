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

# Render a shim body — kept byte-for-byte in sync with install.sh's generator.
# Cache targets produce a self-resolving (version-independent) body; contributor
# targets exec the path directly. See install.sh for the rationale.
render_shim_body() {
  local kind="$1" target="$2" extra_args="$3"
  local runner root="" sub=""

  case "$kind" in
    node) runner="node" ;;
    *) runner="bash" ;;
  esac

  case "$target" in
    */cache/*/bin/dev-workflow.cjs)
      root="${target%/*/bin/dev-workflow.cjs}"
      sub="bin/dev-workflow.cjs"
      ;;
    */cache/*/skills/dev-dashboard/scripts/start.sh)
      root="${target%/*/skills/dev-dashboard/scripts/start.sh}"
      sub="skills/dev-dashboard/scripts/start.sh"
      ;;
    */cache/*/skills/dev-dashboard/scripts/stop.sh)
      root="${target%/*/skills/dev-dashboard/scripts/stop.sh}"
      sub="skills/dev-dashboard/scripts/stop.sh"
      ;;
  esac

  if [ -n "$root" ]; then
    cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
# Resolve the newest installed plugin version at runtime so a marketplace
# update is picked up without reinstalling this shim.
root="$root"
v="\$(ls -1 "\$root" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\$' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
if [ -z "\$v" ] || [ ! -e "\$root/\$v/$sub" ]; then
  echo "dev-workflow: no installed version found under \$root" >&2
  exit 1
fi
exec $runner "\$root/\$v/$sub"$extra_args "\$@"
EOF
  else
    cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec $runner "$target"$extra_args "\$@"
EOF
  fi
}

matches_expected() {
  local shim_path="$1"
  local target_path="$2"
  local extra_args="$3"

  [ -f "$shim_path" ] || return 1
  [ -x "$shim_path" ] || return 1

  local expected
  expected="$(render_shim_body bash "$target_path" "$extra_args")"
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
  expected="$(render_shim_body node "$target_path" '')"
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
  # Any prior marketplace-cached install of the same plugin — version-pinned or
  # self-resolving. Without this match an older version's shim is reported as
  # `conflict` and the install script refuses to refresh it across upgrades.
  if grep -Fq '/cache/dev-workflow/dev-workflow' "$shim_path" \
    && grep -Fq 'dev-workflow.cjs' "$shim_path"; then
    return 0
  fi

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
