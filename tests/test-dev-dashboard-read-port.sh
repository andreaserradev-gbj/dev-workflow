#!/usr/bin/env bash
# Unit tests for dev-dashboard's read-port.cjs config-port reader.
#
# read-port.cjs is the committed helper that start.sh delegates config parsing
# to (replacing the old inline `node -e`), so the launch path carries no
# dynamic-code-execution surface. Contract:
#   node read-port.cjs <config-path>
#   - prints the `port` to stdout ONLY when it is an integer in (0, 65535]
#   - otherwise prints nothing
#   - ALWAYS exits 0 (missing/unreadable/invalid config -> caller uses default)
#
# Two groups:
#   1. Behavioral table — valid/boundary/out-of-range/malformed/missing inputs.
#   2. Static contract — the helper stays dynamic-code-free and start.sh wires
#      it in place of any inline `node -e` (the surface the feature removed).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO_ROOT/plugins/dev-workflow/skills/dev-dashboard/scripts"
READ_PORT="$SCRIPTS/read-port.cjs"
START_SH="$SCRIPTS/start.sh"

PASS=0
FAIL=0

TMP_DIR="$(mktemp -d -t dev-dashboard-read-port-test.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

CONFIG="$TMP_DIR/config.json"

# Run read-port.cjs against an explicit config-file body, asserting both the
# stdout AND a zero exit code (the "always exit 0" half of the contract).
assert_port() {
  local name="$1" body="$2" expected="$3"
  printf '%s' "$body" >"$CONFIG"

  local out rc
  out="$(node "$READ_PORT" "$CONFIG" 2>/dev/null)" && rc=0 || rc=$?

  if [ "$out" = "$expected" ] && [ "$rc" -eq 0 ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "      config:   $body"
    echo "      expected: stdout='$expected' exit=0"
    echo "      got:      stdout='$out' exit=$rc"
    FAIL=$((FAIL + 1))
  fi
}

# Like assert_port but the caller controls the exact argv (e.g. a missing file
# path, or no argument at all). Asserts stdout AND exit 0.
assert_argv() {
  local name="$1" expected="$2"
  shift 2

  local out rc
  out="$(node "$READ_PORT" "$@" 2>/dev/null)" && rc=0 || rc=$?

  if [ "$out" = "$expected" ] && [ "$rc" -eq 0 ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "      expected: stdout='$expected' exit=0"
    echo "      got:      stdout='$out' exit=$rc"
    FAIL=$((FAIL + 1))
  fi
}

assert_static() {
  local name="$1"; shift
  if "$@"; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "--- valid ports echo through ---"
assert_port "typical port -> echoed"        '{"port":3141}'  "3141"
assert_port "lower boundary 1 -> echoed"     '{"port":1}'     "1"
assert_port "upper boundary 65535 -> echoed" '{"port":65535}' "65535"
assert_port "extra config keys ignored"      '{"port":8080,"scanDirs":["x"],"notifications":true}' "8080"

echo
echo "--- out-of-range / wrong-type ports emit nothing ---"
assert_port "port 0 (excluded low) -> empty"      '{"port":0}'      ""
assert_port "port 65536 (excluded high) -> empty" '{"port":65536}'  ""
assert_port "negative port -> empty"              '{"port":-1}'     ""
assert_port "non-integer port -> empty"           '{"port":3141.5}' ""
assert_port "string port -> empty"                '{"port":"3141"}' ""
assert_port "null port -> empty"                  '{"port":null}'   ""
assert_port "missing port field -> empty"         '{"scanDirs":[]}' ""
assert_port "empty object -> empty"               '{}'              ""

echo
echo "--- malformed / missing config still exits 0 (caller falls back) ---"
assert_port "invalid JSON -> empty, exit 0"       'not json {'      ""
assert_port "empty file -> empty, exit 0"         ''                ""
assert_argv "missing config file -> empty, exit 0" "" "$TMP_DIR/does-not-exist.json"
assert_argv "no argument at all -> empty, exit 0"  ""

echo
echo "--- static contract: dynamic-code-free + wired into start.sh ---"
# The whole point of committing this helper is that the launch path has no
# dynamic-code surface — guard against a regression that reintroduces one.
assert_static "read-port.cjs has no eval(" \
  bash -c '! grep -Fq "eval(" "'"$READ_PORT"'"'
assert_static "read-port.cjs has no new Function(" \
  bash -c '! grep -Fq "new Function(" "'"$READ_PORT"'"'
# start.sh must delegate to the committed helper and carry no inline `node -e`
# (the dynamic-code surface this feature removed). Strip comments first so the
# explanatory "no inline node -e" comment in start.sh is not a false match — we
# only care about an actual `node -e` invocation in executable code.
assert_static "start.sh references read-port.cjs helper" \
  grep -Fq "read-port.cjs" "$START_SH"
assert_static "start.sh has no inline 'node -e' invocation" \
  bash -c '! sed "s/#.*//" "'"$START_SH"'" | grep -Fq "node -e"'

echo
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
