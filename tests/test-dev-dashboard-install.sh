#!/usr/bin/env bash
# Regression tests for dev-dashboard's check-install.sh and install.sh
# scripts, exercised against a temp bin directory so the developer's real
# ~/.local/bin is never touched.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO_ROOT/plugins/dev-workflow/skills/dev-dashboard/scripts"
INSTALL="$SCRIPTS/install.sh"
CHECK="$SCRIPTS/check-install.sh"
CLI_TARGET="$REPO_ROOT/plugins/dev-workflow/bin/dev-workflow.cjs"

PASS=0
FAIL=0

# Each test runs in its own temp bin; PATH-leaking cleanup happens via trap.
TMP_ROOT="$(mktemp -d -t dev-dashboard-install-test.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

next_bin() {
  local sub
  sub="$(mktemp -d "$TMP_ROOT/case.XXXXXX")"
  printf '%s/bin\n' "$sub"
}

assert_contains() {
  local name="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "      expected to contain: $needle"
    echo "      got: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local name="$1" needle="$2" haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "      expected NOT to contain: $needle"
    echo "      got: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "      expected: $expected"
    echo "      got: $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "--- canonical install on empty bin dir ---"
BIN_A="$(next_bin)"
INSTALL_A_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_A" bash "$INSTALL" 2>&1)"
assert_contains "empty bin: emits installed line" "installed:$BIN_A" "$INSTALL_A_OUT"
assert_contains "empty bin: emits workflow_installed line" "workflow_installed:$BIN_A/dev-workflow" "$INSTALL_A_OUT"
assert_contains "empty bin: emits path_warning (temp bin not on PATH)" "path_warning:$BIN_A" "$INSTALL_A_OUT"
[ -x "$BIN_A/dev-dashboard" ] && assert_eq "empty bin: dev-dashboard shim is executable" "true" "true" || assert_eq "empty bin: dev-dashboard shim is executable" "true" "false"
[ -x "$BIN_A/dev-dashboard-stop" ] && assert_eq "empty bin: dev-dashboard-stop shim is executable" "true" "true" || assert_eq "empty bin: dev-dashboard-stop shim is executable" "true" "false"
[ -x "$BIN_A/dev-workflow" ] && assert_eq "empty bin: dev-workflow shim is executable" "true" "true" || assert_eq "empty bin: dev-workflow shim is executable" "true" "false"

echo
echo "--- check-install.sh after install ---"
CHECK_A_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_A" bash "$CHECK" 2>&1)"
assert_contains "post-install: status:installed" $'\nstatus:installed' $'\n'"$CHECK_A_OUT"
assert_contains "post-install: workflow_status:installed" "workflow_status:installed" "$CHECK_A_OUT"
assert_contains "post-install: workflow_target points at canonical bundle" "workflow_target:$CLI_TARGET" "$CHECK_A_OUT"
assert_not_contains "post-install: no workflow_conflict line" "workflow_conflict:" "$CHECK_A_OUT"

echo
echo "--- dev-workflow --help reaches the bundled CLI ---"
HELP_OUT="$("$BIN_A/dev-workflow" --help 2>&1)"
assert_contains "dev-workflow --help: usage line" "Usage: dev-workflow" "$HELP_OUT"
assert_contains "dev-workflow --help: lists list command" "list " "$HELP_OUT"

echo
echo "--- re-running install is idempotent ---"
INSTALL_A2_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_A" bash "$INSTALL" 2>&1)"
assert_contains "idempotent: still emits installed" "installed:$BIN_A" "$INSTALL_A2_OUT"
assert_contains "idempotent: still emits workflow_installed" "workflow_installed:$BIN_A/dev-workflow" "$INSTALL_A2_OUT"
CHECK_A2_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_A" bash "$CHECK" 2>&1)"
assert_contains "idempotent: workflow_status remains installed" "workflow_status:installed" "$CHECK_A2_OUT"

echo
echo "--- stale managed dev-workflow shim is refreshed ---"
BIN_B="$(next_bin)"
mkdir -p "$BIN_B"
{
  printf '%s\n' '#!/usr/bin/env bash' \
    'set -euo pipefail' \
    'exec node "/old/path/plugins/dev-workflow/bin/dev-workflow.cjs" "$@"'
} >"$BIN_B/dev-workflow"
chmod +x "$BIN_B/dev-workflow"
CHECK_B_PRE="$(DEV_DASHBOARD_BIN_DIR="$BIN_B" bash "$CHECK" 2>&1)"
assert_contains "stale pre-check: workflow_status:stale" "workflow_status:stale" "$CHECK_B_PRE"
INSTALL_B_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_B" bash "$INSTALL" 2>&1)"
assert_contains "stale install: workflow_installed line" "workflow_installed:$BIN_B/dev-workflow" "$INSTALL_B_OUT"
CHECK_B_POST="$(DEV_DASHBOARD_BIN_DIR="$BIN_B" bash "$CHECK" 2>&1)"
assert_contains "stale post-check: workflow_status:installed" "workflow_status:installed" "$CHECK_B_POST"
SHIM_BODY="$(cat "$BIN_B/dev-workflow")"
assert_contains "stale post-check: shim body now points at canonical target" "$CLI_TARGET" "$SHIM_BODY"

echo
echo "--- stale cached-install dev-workflow shim is refreshed across versions ---"
BIN_CACHE="$(next_bin)"
mkdir -p "$BIN_CACHE"
{
  printf '%s\n' '#!/usr/bin/env bash' \
    'set -euo pipefail' \
    'exec node "/Users/someone/.claude/plugins/cache/dev-workflow/dev-workflow/1.29.0/bin/dev-workflow.cjs" "$@"'
} >"$BIN_CACHE/dev-workflow"
chmod +x "$BIN_CACHE/dev-workflow"
CHECK_CACHE_PRE="$(DEV_DASHBOARD_BIN_DIR="$BIN_CACHE" bash "$CHECK" 2>&1)"
assert_contains "cached-stale pre-check: workflow_status:stale" "workflow_status:stale" "$CHECK_CACHE_PRE"
assert_not_contains "cached-stale pre-check: no workflow_conflict line" "workflow_conflict:" "$CHECK_CACHE_PRE"
INSTALL_CACHE_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_CACHE" bash "$INSTALL" 2>&1)"
assert_contains "cached-stale install: workflow_installed line" "workflow_installed:$BIN_CACHE/dev-workflow" "$INSTALL_CACHE_OUT"
CHECK_CACHE_POST="$(DEV_DASHBOARD_BIN_DIR="$BIN_CACHE" bash "$CHECK" 2>&1)"
assert_contains "cached-stale post-check: workflow_status:installed" "workflow_status:installed" "$CHECK_CACHE_POST"
CACHE_SHIM_BODY="$(cat "$BIN_CACHE/dev-workflow")"
assert_contains "cached-stale post-check: shim body now points at canonical target" "$CLI_TARGET" "$CACHE_SHIM_BODY"
assert_not_contains "cached-stale post-check: old version path replaced" "1.29.0" "$CACHE_SHIM_BODY"

echo
echo "--- unrelated dev-workflow produces conflict; dashboard still installs ---"
BIN_C="$(next_bin)"
mkdir -p "$BIN_C"
{
  printf '%s\n' '#!/usr/bin/env bash' 'echo "not the dev-workflow you are looking for"'
} >"$BIN_C/dev-workflow"
chmod +x "$BIN_C/dev-workflow"
INSTALL_C_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_C" bash "$INSTALL" 2>&1)"
assert_contains "conflict install: dashboard installed line" "installed:$BIN_C" "$INSTALL_C_OUT"
assert_contains "conflict install: workflow_conflict line" "workflow_conflict:$BIN_C/dev-workflow" "$INSTALL_C_OUT"
assert_not_contains "conflict install: no workflow_installed line" "workflow_installed:" "$INSTALL_C_OUT"
[ -x "$BIN_C/dev-dashboard" ] && assert_eq "conflict install: dev-dashboard shim still installed" "true" "true" || assert_eq "conflict install: dev-dashboard shim still installed" "true" "false"
[ -x "$BIN_C/dev-dashboard-stop" ] && assert_eq "conflict install: dev-dashboard-stop shim still installed" "true" "true" || assert_eq "conflict install: dev-dashboard-stop shim still installed" "true" "false"
CONFLICT_BODY="$(cat "$BIN_C/dev-workflow")"
assert_contains "conflict install: unrelated shim untouched" "not the dev-workflow you are looking for" "$CONFLICT_BODY"
CHECK_C_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_C" bash "$CHECK" 2>&1)"
assert_contains "conflict check: workflow_status:conflict" "workflow_status:conflict" "$CHECK_C_OUT"
assert_contains "conflict check: workflow_conflict line" "workflow_conflict:$BIN_C/dev-workflow" "$CHECK_C_OUT"
assert_contains "conflict check: dashboard status still installed" $'\nstatus:installed' $'\n'"$CHECK_C_OUT"

echo
echo "--- path_warning is emitted when temp bin is not on PATH ---"
BIN_D="$(next_bin)"
INSTALL_D_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_D" bash "$INSTALL" 2>&1)"
assert_contains "path_warning: present when temp bin not on PATH" "path_warning:$BIN_D" "$INSTALL_D_OUT"

echo
echo "--- self-resolving shim across marketplace-cache versions ---"
# Build a fake marketplace cache with two installed versions, install from the
# OLDER one, and confirm the resulting shim resolves the NEWEST version at
# runtime — and keeps doing so when a newer version appears, with no reinstall.
# Only the stub CLI is exec'd here; no server is ever spawned.
CACHE_ROOT="$TMP_ROOT/cache/dev-workflow/dev-workflow"
make_version() {
  local ver="$1"
  local vdir="$CACHE_ROOT/$ver"
  mkdir -p "$vdir/bin" "$vdir/skills/dev-dashboard/scripts"
  printf 'console.log("dev-workflow %s");\n' "$ver" >"$vdir/bin/dev-workflow.cjs"
  # install.sh / check-install.sh need start.sh + stop.sh present alongside them.
  cp "$SCRIPTS/install.sh" "$SCRIPTS/check-install.sh" "$SCRIPTS/start.sh" "$SCRIPTS/stop.sh" \
    "$vdir/skills/dev-dashboard/scripts/"
}
make_version 1.0.0
make_version 1.1.0

BIN_SR="$(next_bin)"
SR_INSTALL_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_SR" bash "$CACHE_ROOT/1.0.0/skills/dev-dashboard/scripts/install.sh" 2>&1)"
assert_contains "self-resolving: workflow_installed line" "workflow_installed:$BIN_SR/dev-workflow" "$SR_INSTALL_OUT"

SR_BODY="$(cat "$BIN_SR/dev-workflow")"
assert_contains "self-resolving: body bakes version-stripped root" "root=\"$CACHE_ROOT\"" "$SR_BODY"
assert_not_contains "self-resolving: body has no pinned version path" "1.0.0/bin/dev-workflow.cjs" "$SR_BODY"

SR_RUN="$("$BIN_SR/dev-workflow" 2>&1)"
assert_contains "self-resolving: runs newest installed version (1.1.0)" "dev-workflow 1.1.0" "$SR_RUN"

# A newer version lands (simulating /plugin update) — picked up with NO reinstall.
make_version 1.2.0
SR_RUN2="$("$BIN_SR/dev-workflow" 2>&1)"
assert_contains "self-resolving: picks up 1.2.0 with no reinstall" "dev-workflow 1.2.0" "$SR_RUN2"

# Version-independent body: check-install run from ANY version reports installed.
SR_CHECK_OLD="$(DEV_DASHBOARD_BIN_DIR="$BIN_SR" bash "$CACHE_ROOT/1.0.0/skills/dev-dashboard/scripts/check-install.sh" 2>&1)"
assert_contains "self-resolving: check from old version says installed" "workflow_status:installed" "$SR_CHECK_OLD"
SR_CHECK_NEW="$(DEV_DASHBOARD_BIN_DIR="$BIN_SR" bash "$CACHE_ROOT/1.2.0/skills/dev-dashboard/scripts/check-install.sh" 2>&1)"
assert_contains "self-resolving: check from new version says installed (no spurious stale)" "workflow_status:installed" "$SR_CHECK_NEW"

# A stale version-pinned shim from an older release upgrades cleanly to self-resolving.
{
  printf '%s\n' '#!/usr/bin/env bash' \
    'set -euo pipefail' \
    "exec node \"$CACHE_ROOT/1.0.0/bin/dev-workflow.cjs\" \"\$@\""
} >"$BIN_SR/dev-workflow"
chmod +x "$BIN_SR/dev-workflow"
SR_UPGRADE_OUT="$(DEV_DASHBOARD_BIN_DIR="$BIN_SR" bash "$CACHE_ROOT/1.2.0/skills/dev-dashboard/scripts/install.sh" 2>&1)"
assert_contains "pinned->self-resolving: refreshed (not conflict)" "workflow_installed:$BIN_SR/dev-workflow" "$SR_UPGRADE_OUT"
SR_UPGRADE_RUN="$("$BIN_SR/dev-workflow" 2>&1)"
assert_contains "pinned->self-resolving: now tracks newest (1.2.0)" "dev-workflow 1.2.0" "$SR_UPGRADE_RUN"

echo
echo "--- summary ---"
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
