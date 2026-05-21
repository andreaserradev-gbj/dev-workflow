#!/usr/bin/env bash
# Install user-local shims for the bundled dev-dashboard scripts and the
# dev-workflow CLI.
#
# Usage: bash install.sh
#   Creates or updates shims in the selected user-local bin directory.
#
# Output:
#   installed:<bin-dir>          — dashboard shims created or updated
#   workflow_installed:<path>    — dev-workflow shim created or refreshed
#   workflow_conflict:<path>     — dev-workflow already exists and is unmanaged;
#                                   dashboard shims still installed
#   path_warning:<bin-dir>       — install succeeded but bin dir is not on PATH
#   error:<message>              — install failed (or workflow CLI bundle missing)

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

write_workflow_shim() {
  local target_path="$1"
  local shim_path="$2"
  local tmp_path

  tmp_path="$(mktemp "${TMPDIR:-/tmp}/dev-workflow-shim.XXXXXX")"
  cat >"$tmp_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "$target_path" "\$@"
EOF
  chmod +x "$tmp_path"
  mv "$tmp_path" "$shim_path"
}

is_managed_shim() {
  local shim_path="$1"
  local target_path="$2"

  [ -f "$shim_path" ] || return 1

  grep -Fq "exec bash \"$target_path\"" "$shim_path" && return 0
  grep -Fq '/skills/dev-dashboard/scripts/' "$shim_path" && return 0

  return 1
}

is_managed_workflow_shim() {
  local shim_path="$1"
  local target_path="$2"

  [ -f "$shim_path" ] || return 1

  grep -Fq "exec node \"$target_path\"" "$shim_path" && return 0
  grep -Fq '/plugins/dev-workflow/bin/dev-workflow.cjs' "$shim_path" && return 0
  # Any prior marketplace-cached install of the same plugin. Without this
  # match an older version's shim looks foreign and the next install run
  # cannot refresh it across version upgrades.
  if grep -Fq '/cache/dev-workflow/dev-workflow/' "$shim_path" \
    && grep -Fq '/bin/dev-workflow.cjs' "$shim_path"; then
    return 0
  fi

  return 1
}

refuse_unrelated_target() {
  local shim_path="$1"
  local target_path="$2"
  local command_name="$3"

  if [ ! -e "$shim_path" ]; then
    return 0
  fi

  if is_managed_shim "$shim_path" "$target_path"; then
    return 0
  fi

  echo "error:Refusing to overwrite existing unrelated command at $command_name ($shim_path)"
  exit 1
}

refuse_unrelated_target "$START_SHIM" "$START_SCRIPT" 'dev-dashboard'
refuse_unrelated_target "$STOP_SHIM" "$STOP_SCRIPT" 'dev-dashboard-stop'

write_shim "$START_SCRIPT" "$START_SHIM" ' --open'
write_shim "$STOP_SCRIPT" "$STOP_SHIM" ''

echo "installed:${BIN_DIR}"

# dev-workflow shim is best-effort: a missing CLI bundle or pre-existing
# unrelated command must not block dashboard install.
if [ ! -f "$CLI_TARGET" ]; then
  echo "error:dev-workflow CLI bundle not found at $CLI_TARGET"
elif [ -e "$WORKFLOW_SHIM" ] && ! is_managed_workflow_shim "$WORKFLOW_SHIM" "$CLI_TARGET"; then
  echo "workflow_conflict:${WORKFLOW_SHIM}"
else
  write_workflow_shim "$CLI_TARGET" "$WORKFLOW_SHIM"
  echo "workflow_installed:${WORKFLOW_SHIM}"
fi

case ":${PATH:-}:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "path_warning:${BIN_DIR}"
    ;;
esac
