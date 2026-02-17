#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../plugins/dev-workflow/scripts" && pwd)"
PASS=0
FAIL=0

run_test() {
  local name="$1" expected_exit="$2" expected_output="$3"
  shift 3
  local actual_output actual_exit
  actual_output=$("$@" 2>&1) && actual_exit=0 || actual_exit=$?

  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "FAIL: $name (exit: expected $expected_exit, got $actual_exit)"
    echo "      output: $actual_output"
    FAIL=$((FAIL + 1))
    return
  fi

  if [ -n "$expected_output" ] && [ "$actual_output" != "$expected_output" ]; then
    echo "FAIL: $name (output: expected '$expected_output', got '$actual_output')"
    FAIL=$((FAIL + 1))
    return
  fi

  echo "PASS: $name"
  PASS=$((PASS + 1))
}

run_test_empty() {
  local name="$1" expected_exit="$2"
  shift 2
  local actual_output actual_exit
  actual_output=$("$@" 2>&1) && actual_exit=0 || actual_exit=$?

  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "FAIL: $name (exit: expected $expected_exit, got $actual_exit)"
    echo "      output: $actual_output"
    FAIL=$((FAIL + 1))
    return
  fi

  if [ -n "$actual_output" ]; then
    echo "FAIL: $name (expected empty output, got '$actual_output')"
    FAIL=$((FAIL + 1))
    return
  fi

  echo "PASS: $name"
  PASS=$((PASS + 1))
}

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git branch --show-current)"

echo "--- discover.sh ---"

run_test "root returns git toplevel" \
  0 "$PROJECT_ROOT" \
  bash "$SCRIPT_DIR/discover.sh" root

run_test "checkpoints with no .dev/ exits 1" \
  1 "No .dev/ directory" \
  bash "$SCRIPT_DIR/discover.sh" checkpoints /tmp

run_test "features with no .dev/ exits 1" \
  1 "No .dev/ directory" \
  bash "$SCRIPT_DIR/discover.sh" features /tmp

run_test_empty "features with non-matching filter returns empty" \
  0 \
  bash "$SCRIPT_DIR/discover.sh" features "$PROJECT_ROOT" "nonexistent-xyz-999"

run_test "archived with no .dev-archive/ returns empty exit 0" \
  0 "" \
  bash "$SCRIPT_DIR/discover.sh" archived /tmp

run_test "invalid mode exits 1" \
  1 "Usage: discover.sh {root|checkpoints|features|archived|status-reports} ..." \
  bash "$SCRIPT_DIR/discover.sh" bogus

echo ""
echo "--- git-state.sh ---"

run_test "brief outputs branch line" \
  0 "" \
  bash "$SCRIPT_DIR/git-state.sh" brief
# Can't match exact output (branch varies), just check exit 0

run_test "full outputs branch line" \
  0 "" \
  bash "$SCRIPT_DIR/git-state.sh" full

# Test outside git repo
TMPDIR_NOGIT="$(mktemp -d)"
run_test "brief outside git repo outputs git:false" \
  0 "git:false" \
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX -u GIT_COMMON_DIR \
    bash -c "cd '$TMPDIR_NOGIT' && bash '$SCRIPT_DIR/git-state.sh' brief"

run_test "full outside git repo outputs git:false" \
  0 "git:false" \
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX -u GIT_COMMON_DIR \
    bash -c "cd '$TMPDIR_NOGIT' && bash '$SCRIPT_DIR/git-state.sh' full"
rmdir "$TMPDIR_NOGIT"

run_test "invalid mode exits 1" \
  1 "Usage: git-state.sh {brief|full}" \
  bash "$SCRIPT_DIR/git-state.sh" bogus

echo ""
echo "--- worktree-setup.sh ---"

run_test "check on non-default branch returns skip" \
  0 "skip:not-default-branch" \
  bash "$SCRIPT_DIR/worktree-setup.sh" check test-feature "$PROJECT_ROOT" "feature/some-branch"

run_test "check on main branch returns offer" \
  0 "offer" \
  bash "$SCRIPT_DIR/worktree-setup.sh" check "nonexistent-worktree-test" "$PROJECT_ROOT" "main"

TMPDIR_NOGIT2="$(mktemp -d)"
run_test "check outside git repo returns skip" \
  0 "skip:not-a-git-repo" \
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX -u GIT_COMMON_DIR \
    bash -c "cd '$TMPDIR_NOGIT2' && bash '$SCRIPT_DIR/worktree-setup.sh' check test-feature '$TMPDIR_NOGIT2' main"
rmdir "$TMPDIR_NOGIT2"

run_test "invalid mode exits 1" \
  1 "Usage: worktree-setup.sh {check|execute} ..." \
  bash "$SCRIPT_DIR/worktree-setup.sh" bogus

echo ""
echo "--- validate.sh ---"

run_test "normalize UPPER-CASE!" \
  0 "upper-case" \
  bash "$SCRIPT_DIR/validate.sh" normalize "UPPER-CASE!"

run_test "normalize spaces and symbols" \
  0 "my-cool-feature" \
  bash "$SCRIPT_DIR/validate.sh" normalize "My Cool Feature!!!"

run_test "path traversal rejected" \
  1 "Invalid checkpoint path (traversal)" \
  bash "$SCRIPT_DIR/validate.sh" checkpoint-path "../etc/passwd" "$PROJECT_ROOT"

run_test "checkpoint path outside .dev/ rejected" \
  1 "Invalid checkpoint path" \
  bash "$SCRIPT_DIR/validate.sh" checkpoint-path "$PROJECT_ROOT/other/checkpoint.md" "$PROJECT_ROOT"

run_test "feature path outside .dev/ rejected" \
  1 "Invalid feature path" \
  bash "$SCRIPT_DIR/validate.sh" feature-path "$PROJECT_ROOT/other/feature" "$PROJECT_ROOT"

run_test "valid slug passes" \
  0 "my-feature" \
  bash "$SCRIPT_DIR/validate.sh" slug "my-feature"

run_test "invalid slug rejected" \
  1 "Invalid feature name slug: UPPER" \
  bash "$SCRIPT_DIR/validate.sh" slug "UPPER"

run_test "invalid mode exits 1" \
  1 "Usage: validate.sh {checkpoint-path|feature-path|normalize|slug} ..." \
  bash "$SCRIPT_DIR/validate.sh" bogus

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
