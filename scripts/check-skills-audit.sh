#!/usr/bin/env bash
#
# check-skills-audit.sh — fetch the skills.sh (Vercel) security audits for this
# plugin's skills and print a scannable before/after-friendly summary.
#
# The skills.sh scanners (Gen Agent Trust Hub, Socket, Snyk, Runlayer) run
# autonomously server-side; there is no local runner. This script is the easy
# way to pull the published results so a re-scan can be confirmed without
# clicking through the web UI.
#
# Usage:
#   scripts/check-skills-audit.sh                      # all shipped skills
#   scripts/check-skills-audit.sh dev-wiki dev-review  # only these skills
#   scripts/check-skills-audit.sh --json               # raw JSON passthrough
#   OWNER=foo REPO=bar scripts/check-skills-audit.sh   # override the source
#   STALE_DAYS=3 scripts/check-skills-audit.sh         # tune the stale marker
#
# Exit status: 0 always (it is a report). Network/HTTP failures for a single
# skill are reported inline and skipped; they do not abort the run.

set -eu

OWNER="${OWNER:-andreaserradev-gbj}"
REPO="${REPO:-dev-workflow}"
API="https://skills.sh/api/v1/skills/audit"
STALE_DAYS="${STALE_DAYS:-7}"

# Default = the skills shipped by this plugin (see plugins/dev-workflow/skills/).
DEFAULT_SKILLS=(dev-plan dev-checkpoint dev-resume dev-review dev-wiki dev-wrapup dev-dashboard)

JSON_MODE=0
SKILLS=()
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    -h|--help)
      sed -n '2,/^set -eu/p' "$0" | sed 's/^# \{0,1\}//; /^set -eu/d'
      exit 0
      ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) SKILLS+=("$arg") ;;
  esac
done
if [ "${#SKILLS[@]}" -eq 0 ]; then
  SKILLS=("${DEFAULT_SKILLS[@]}")
fi

command -v curl >/dev/null 2>&1 || { echo "error: curl not found" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found" >&2; exit 2; }

echo "skills.sh audits for ${OWNER}/${REPO}  (stale marker: > ${STALE_DAYS}d)"
echo

for skill in "${SKILLS[@]}"; do
  url="${API}/${OWNER}/${REPO}/${skill}"
  if ! resp="$(curl -fsS "$url" 2>/dev/null)"; then
    echo "=== ${skill} ==="
    echo "  (no audit data — fetch failed or skill not published)"
    echo
    continue
  fi

  if [ "$JSON_MODE" -eq 1 ]; then
    printf '%s\n' "$resp" | python3 -m json.tool
    continue
  fi

  RESP="$resp" STALE_DAYS="$STALE_DAYS" python3 - "$skill" <<'PY'
import json, os, re, sys
from datetime import datetime, timezone

skill = sys.argv[1]
stale_days = int(os.environ.get("STALE_DAYS", "7"))

def parse_dt(s):
    s = (s or "").strip().replace("Z", "+00:00")
    # normalize fractional seconds to exactly 6 digits so fromisoformat accepts it
    s = re.sub(r"\.(\d+)", lambda m: "." + (m.group(1) + "000000")[:6], s)
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None

try:
    data = json.loads(os.environ.get("RESP", ""))
except json.JSONDecodeError:
    print(f"=== {skill} ===")
    print("  (invalid JSON response)")
    print()
    sys.exit(0)

now = datetime.now(timezone.utc)
audits = data.get("audits", []) or []

print(f"=== {skill} ===")
if not audits:
    print("  (no audits recorded)")
    print()
    sys.exit(0)

warn = fail = 0
worst = None
order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "SAFE": 0}

for a in audits:
    prov = a.get("provider", "?")
    status = (a.get("status") or "?").upper()
    risk = a.get("riskLevel") or "-"
    at = a.get("auditedAt") or ""
    dt = parse_dt(at)
    when = dt.strftime("%Y-%m-%d %H:%M") if dt else (at or "?")
    age = ""
    if dt:
        days = (now - dt).days
        flag = "  [STALE >%dd]" % stale_days if days > stale_days else ""
        age = "  (%dd ago)%s" % (days, flag)

    if status == "WARN":
        warn += 1
    elif status == "FAIL":
        fail += 1
    if risk in order and (worst is None or order[risk] > order.get(worst, -1)):
        worst = risk

    print(f"  {prov:<22} {status:<5} {risk:<7} {when}{age}")
    cats = a.get("categories") or []
    if cats:
        print(f"       categories: {', '.join(cats)}")
    summ = (a.get("summary") or "").strip()
    if summ:
        if len(summ) > 280:
            summ = summ[:277] + "..."
        print(f"       {summ}")

print(f"  -> worst risk: {worst or 'n/a'}   ({warn} warn / {fail} fail)")
print()
PY
done
