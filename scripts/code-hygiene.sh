#!/bin/sh
#
# Consolidated code-hygiene gate.
#
# Runs both static-analysis tools across the tools/ packages and accepts or
# rejects based on thresholds:
#
#   knip  - unused files / dependencies / exports, run per package (the three
#           tools/ packages are independent, no root workspace). The TOTAL issue
#           count across all packages must not exceed KNIP_BASELINE_ISSUES. This
#           is a ratchet: today's findings are grandfathered in, but any NEW
#           unused file/dep/export pushes the count over the line and fails the
#           gate. Lower the number as findings get cleaned up.
#
#   jscpd - copy/paste duplication across the src trees. Duplication % must stay
#           under the `threshold` in .jscpd.json (jscpd exits non-zero on breach).
#
# Network behaviour: both tools run via `npx`. If they cannot be fetched/run at
# all (e.g. offline with a cold npx cache) the corresponding gate is SKIPPED with
# a warning rather than blocking the push. A gate only FAILS on a real threshold
# breach, never on tool unavailability.
#
# Usage: sh scripts/code-hygiene.sh
# Exit:  0 = gates passed (or skipped), 1 = a threshold was breached.

set -u

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$repo_root" || exit 1

# --- Configuration ----------------------------------------------------------
# Baseline captured 2026-06-23: core 0 + cli 0 + dashboard 16 (5 exports,
# 11 types) = 16. (gray-matter dep, eslint-plugin-prettier devDep, and core's
# prettier-unlisted binary were cleaned up — see git history.)
# Override with an env var for a quick what-if, e.g. KNIP_BASELINE_ISSUES=0.
KNIP_BASELINE_ISSUES=${KNIP_BASELINE_ISSUES:-16}
KNIP_PKGS="tools/dev-workflow-core tools/dev-workflow-cli tools/dev-dashboard"
JSCPD_PATHS="tools/dev-workflow-core/src tools/dev-workflow-cli/src tools/dev-dashboard/src"
# Pinned EXACTLY (not by major range): this gate blocks pushes, so it must be
# deterministic. The baselines/thresholds below were calibrated against these
# versions. Bump a pin -> re-measure the baseline before committing.
KNIP_VERSION="knip@6.18.0"
JSCPD_VERSION="jscpd@5.0.11"

fail=0

# --- knip -------------------------------------------------------------------
echo "[knip] unused files / deps / exports"
knip_total=0
knip_ran=1
for pkg in $KNIP_PKGS; do
  json=$(npx --yes "$KNIP_VERSION" --directory "$pkg" --reporter json 2>/dev/null)
  count=$(printf '%s' "$json" | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const j = JSON.parse(s);
        let n = 0;
        for (const it of (j.issues || []))
          for (const k of Object.keys(it))
            if (Array.isArray(it[k])) n += it[k].length;
        console.log(n);
      } catch (e) { console.log("ERR"); }
    });' 2>/dev/null)
  if [ "$count" = "ERR" ] || [ -z "$count" ]; then
    echo "  ! $pkg: knip could not run (offline?) - skipping knip gate"
    knip_ran=0
    break
  fi
  echo "  $pkg: $count"
  knip_total=$((knip_total + count))
done

if [ "$knip_ran" = "1" ]; then
  echo "  total: $knip_total (baseline $KNIP_BASELINE_ISSUES)"
  if [ "$knip_total" -gt "$KNIP_BASELINE_ISSUES" ]; then
    echo "  FAIL: knip issues rose above baseline."
    echo "        Inspect with: npx $KNIP_VERSION --directory <package>"
    echo "        Fix the new finding, or update KNIP_BASELINE_ISSUES if intentional."
    fail=1
  else
    echo "  PASS: knip within baseline"
  fi
fi

# --- jscpd ------------------------------------------------------------------
echo "[jscpd] duplication (.jscpd.json threshold)"
if ! npx --yes "$JSCPD_VERSION" --version >/dev/null 2>&1; then
  echo "  ! jscpd could not run (offline?) - skipping jscpd gate"
elif npx --yes "$JSCPD_VERSION" $JSCPD_PATHS; then
  echo "  PASS: jscpd under threshold"
else
  echo "  FAIL: duplication exceeds the threshold in .jscpd.json."
  echo "        Refactor the new clones, or raise the threshold if intentional."
  fail=1
fi

exit $fail
