#!/usr/bin/env bash
# Regression test for stop.sh's cross-version process-matching pattern.
#
# Two assertions:
#   1. stop.sh declares the documented SERVER_ENTRY_PATTERN constant.
#   2. `pgrep -f` with that pattern matches a fake server whose command line
#      lives at a cross-version-shaped cache path
#      (`.../cache/dev-workflow/dev-workflow/<version>/skills/dev-dashboard/...`).
#
# This test does NOT invoke stop.sh end-to-end — stop.sh would also kill the
# developer's real running dev-dashboard. The pattern itself is exercised
# standalone, which is the property the cross-version fix has to preserve.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STOP_SH="$REPO_ROOT/plugins/dev-workflow/skills/dev-dashboard/scripts/stop.sh"

# Must mirror SERVER_ENTRY_PATTERN in stop.sh. Update both if the path
# fragment ever moves (assertion 1 below would catch a drift here too).
EXPECTED_PATTERN='/skills/dev-dashboard/dashboard/server/index.cjs'

PASS=0
FAIL=0

cleanup_pids=()
cleanup() {
  local pid
  for pid in "${cleanup_pids[@]+"${cleanup_pids[@]}"}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# 1. Lock in the contract — stop.sh must declare the documented pattern.
if grep -Fq "SERVER_ENTRY_PATTERN=\"$EXPECTED_PATTERN\"" "$STOP_SH"; then
  echo "PASS: stop.sh declares SERVER_ENTRY_PATTERN=\"$EXPECTED_PATTERN\""
  PASS=$((PASS + 1))
else
  echo "FAIL: stop.sh does not declare SERVER_ENTRY_PATTERN=\"$EXPECTED_PATTERN\""
  grep -n "SERVER_ENTRY_PATTERN" "$STOP_SH" | sed 's/^/      /'
  FAIL=$((FAIL + 1))
fi

# 2. Spawn a fake server at a cross-version-shaped path and confirm the
#    pattern matches its command line via pgrep -f.
if command -v pgrep >/dev/null 2>&1; then
  TMP_STOP="$(mktemp -d -t dev-dashboard-stop-test.XXXXXX)"
  trap 'cleanup; rm -rf "$TMP_STOP"' EXIT
  FAKE_DIR="$TMP_STOP/cache/dev-workflow/dev-workflow/9.9.9/skills/dev-dashboard/dashboard/server"
  mkdir -p "$FAKE_DIR"
  FAKE_SERVER="$FAKE_DIR/index.cjs"
  cat >"$FAKE_SERVER" <<'EOF'
#!/usr/bin/env bash
sleep 30
EOF
  chmod +x "$FAKE_SERVER"

  "$FAKE_SERVER" &
  FAKE_PID=$!
  cleanup_pids+=("$FAKE_PID")

  # Give the process a moment to enter the process table.
  sleep 1

  if pgrep -f "$EXPECTED_PATTERN" 2>/dev/null | grep -qx "$FAKE_PID"; then
    echo "PASS: pgrep with cross-version pattern matches a fake server at $FAKE_DIR"
    PASS=$((PASS + 1))
  else
    echo "FAIL: pgrep -f '$EXPECTED_PATTERN' did not match fake PID $FAKE_PID"
    echo "      ps for fake pid:"
    ps -p "$FAKE_PID" -o command= 2>/dev/null | sed 's/^/        /' || true
    echo "      pgrep output:"
    pgrep -af "$EXPECTED_PATTERN" 2>/dev/null | sed 's/^/        /' || true
    FAIL=$((FAIL + 1))
  fi
else
  echo "SKIP: pgrep not available; cannot exercise pattern match"
fi

echo
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
