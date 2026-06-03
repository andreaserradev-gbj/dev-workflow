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
#
# Shims are self-resolving across versions: when the target lives under a
# marketplace cache (`…/cache/dev-workflow/dev-workflow/<version>/…`), the shim
# bakes the version-stripped root and resolves the newest installed version at
# runtime, so a `/plugin update` is picked up with no reinstall. For a
# contributor-mode target (the repo's `plugins/…` tree, no versioned cache
# segment) the shim execs the path directly.

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

# Render a shim body. For a marketplace-cached target the body resolves the
# newest installed plugin version at runtime (version-independent output, so
# every version writes a byte-identical shim). For a contributor-mode target the
# body execs the path directly. Kept byte-for-byte in sync with the matching
# generator in check-install.sh.
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

write_shim_file() {
  local kind="$1" target="$2" shim_path="$3" extra_args="$4"
  local tmp_path
  tmp_path="$(mktemp "${TMPDIR:-/tmp}/dev-workflow-shim.XXXXXX")"
  render_shim_body "$kind" "$target" "$extra_args" >"$tmp_path"
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
  # Any prior marketplace-cached install of the same plugin — version-pinned
  # (`…/dev-workflow/<version>/bin/dev-workflow.cjs`) or self-resolving
  # (`root="…/dev-workflow"`). Without this match an older version's shim looks
  # foreign and the next install run cannot refresh it across version upgrades.
  if grep -Fq '/cache/dev-workflow/dev-workflow' "$shim_path" \
    && grep -Fq 'dev-workflow.cjs' "$shim_path"; then
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

write_shim_file bash "$START_SCRIPT" "$START_SHIM" ' --open'
write_shim_file bash "$STOP_SCRIPT" "$STOP_SHIM" ''

echo "installed:${BIN_DIR}"

# dev-workflow shim is best-effort: a missing CLI bundle or pre-existing
# unrelated command must not block dashboard install.
if [ ! -f "$CLI_TARGET" ]; then
  echo "error:dev-workflow CLI bundle not found at $CLI_TARGET"
elif [ -e "$WORKFLOW_SHIM" ] && ! is_managed_workflow_shim "$WORKFLOW_SHIM" "$CLI_TARGET"; then
  echo "workflow_conflict:${WORKFLOW_SHIM}"
else
  write_shim_file node "$CLI_TARGET" "$WORKFLOW_SHIM" ''
  echo "workflow_installed:${WORKFLOW_SHIM}"
fi

case ":${PATH:-}:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "path_warning:${BIN_DIR}"
    ;;
esac
