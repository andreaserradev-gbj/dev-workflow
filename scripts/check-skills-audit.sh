#!/usr/bin/env bash
#
# check-skills-audit.sh — fetch the skills.sh (Vercel) security audits for this
# plugin's skills and print a scannable, before/after-friendly summary.
#
# The skills.sh scanners (Gen Agent Trust Hub, Socket, Snyk) run autonomously
# server-side, hours after a release; there is no local runner. This script is
# the easy way to pull the published results so a re-scan can be confirmed
# without clicking through the web UI. It also backs the weekly
# .github/workflows/skills-audit.yml job.
#
# Usage:
#   scripts/check-skills-audit.sh                       # all shipped skills (text)
#   scripts/check-skills-audit.sh dev-wiki dev-review   # only these skills
#   scripts/check-skills-audit.sh --markdown            # Markdown report (job summary)
#   scripts/check-skills-audit.sh --json                # raw JSON passthrough
#   scripts/check-skills-audit.sh --fail-on HIGH        # exit non-zero on any active HIGH
#
# Environment overrides:
#   OWNER / REPO         source repo (default andreaserradev-gbj/dev-workflow)
#   STALE_DAYS           age (days) past which an audit is marked [STALE] (default 7)
#   RETIRED_PROVIDERS    comma/space list of providers excluded from the rollup
#                        and the --fail-on gate (default "Runlayer"); shown as a
#                        footnote so a retired provider's stale finding never
#                        trips the alert. skills.sh dropped Runlayer — it no
#                        longer appears on freshly re-scanned skills.
#
# Exit status: 0 normally. With --fail-on LEVEL, exits 1 if any ACTIVE (non-
# retired) provider's risk is >= LEVEL (HIGH|MEDIUM|LOW). Per-skill network/HTTP
# failures are reported inline and never abort the run.

set -eu

OWNER="${OWNER:-andreaserradev-gbj}"
REPO="${REPO:-dev-workflow}"
API="https://skills.sh/api/v1/skills/audit"
STALE_DAYS="${STALE_DAYS:-7}"
RETIRED_PROVIDERS="${RETIRED_PROVIDERS-Runlayer}"

# Default = the skills shipped by this plugin (see plugins/dev-workflow/skills/).
DEFAULT_SKILLS=(dev-plan dev-checkpoint dev-resume dev-review dev-wiki dev-wrapup dev-dashboard)

MODE="text"
FAIL_ON=""
SKILLS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --json) MODE="json" ;;
    --markdown|--md) MODE="markdown" ;;
    --fail-on)
      shift
      [ "$#" -gt 0 ] || { echo "error: --fail-on needs a level (HIGH|MEDIUM|LOW)" >&2; exit 2; }
      FAIL_ON="$1"
      ;;
    --fail-on=*) FAIL_ON="${1#*=}" ;;
    -h|--help)
      sed -n '2,/^set -eu/p' "$0" | sed 's/^# \{0,1\}//; /^set -eu/d'
      exit 0
      ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) SKILLS+=("$1") ;;
  esac
  shift
done
if [ "${#SKILLS[@]}" -eq 0 ]; then
  SKILLS=("${DEFAULT_SKILLS[@]}")
fi

command -v curl >/dev/null 2>&1 || { echo "error: curl not found" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found" >&2; exit 2; }

# Fetch every skill's audit into a temp dir (index-keyed so odd skill names are
# never used as filenames). A missing file = the fetch failed for that skill.
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

idx=0
for skill in "${SKILLS[@]}"; do
  url="${API}/${OWNER}/${REPO}/${skill}"
  curl -fsS "$url" -o "$tmpdir/${idx}.json" 2>/dev/null || rm -f "$tmpdir/${idx}.json"
  idx=$((idx + 1))
done

# One python pass aggregates across all skills so the rollup, the retired-
# provider exclusion, and the --fail-on exit code are computed globally.
MODE="$MODE" FAIL_ON="$FAIL_ON" AUDIT_TMPDIR="$tmpdir" \
OWNER="$OWNER" REPO="$REPO" STALE_DAYS="$STALE_DAYS" \
RETIRED_PROVIDERS="$RETIRED_PROVIDERS" \
python3 - "${SKILLS[@]}" <<'PY' || exit 1
import json, os, re, sys, textwrap
from collections import OrderedDict
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

skills = sys.argv[1:]
mode = os.environ.get("MODE", "text")
fail_on = os.environ.get("FAIL_ON", "").strip().upper()
tmpdir = os.environ["AUDIT_TMPDIR"]
owner = os.environ.get("OWNER", "")
repo = os.environ.get("REPO", "")
stale_days = int(os.environ.get("STALE_DAYS", "7") or "7")
retired = {p.strip().lower()
           for p in re.split(r"[,\s]+", os.environ.get("RETIRED_PROVIDERS", ""))
           if p.strip()}

ORDER = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "SAFE": 0}
now = datetime.now(timezone.utc)


def parse_dt(s):
    s = (s or "").strip().replace("Z", "+00:00")
    # normalize fractional seconds to exactly 6 digits so fromisoformat accepts it
    s = re.sub(r"\.(\d+)", lambda m: "." + (m.group(1) + "000000")[:6], s)
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def load(idx):
    path = os.path.join(tmpdir, "%d.json" % idx)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (ValueError, OSError):
        return "invalid"


records = []              # flat list of finding dicts (active + retired)
no_data = OrderedDict()   # skill -> reason it has no findings

for idx, skill in enumerate(skills):
    data = load(idx)
    if data is None:
        no_data[skill] = "fetch failed or skill not published"
        continue
    if data == "invalid":
        no_data[skill] = "invalid JSON response"
        continue
    audits = (data.get("audits") if isinstance(data, dict) else None) or []
    if not audits:
        no_data[skill] = "no audits recorded"
        continue
    for a in audits:
        prov = a.get("provider") or "?"
        dt = parse_dt(a.get("auditedAt"))
        days = (now - dt).days if dt else None
        records.append({
            "skill": skill,
            "provider": prov,
            "status": (a.get("status") or "?").upper(),
            "risk": (a.get("riskLevel") or "").upper(),
            "risk_raw": a.get("riskLevel") or "-",
            "dt": dt,
            "days": days,
            "stale": days is not None and days > stale_days,
            "categories": a.get("categories") or [],
            "summary": (a.get("summary") or "").strip(),
            "retired": prov.strip().lower() in retired,
        })

active = [r for r in records if not r["retired"]]
retired_recs = [r for r in records if r["retired"]]

warn = sum(1 for r in active if r["status"] == "WARN")
fail = sum(1 for r in active if r["status"] == "FAIL")
high_count = sum(1 for r in active if r["risk"] == "HIGH")
worst = None
for r in active:
    if r["risk"] in ORDER and (worst is None or ORDER[r["risk"]] > ORDER.get(worst, -1)):
        worst = r["risk"]

triggered = []
if fail_on in ORDER:
    thr = ORDER[fail_on]
    triggered = [r for r in active if r["risk"] in ORDER and ORDER[r["risk"]] >= thr]


def fmt_when(r):
    return r["dt"].strftime("%Y-%m-%d %H:%M") if r["dt"] else "?"


def retired_notes():
    provs = OrderedDict()
    for r in retired_recs:
        provs.setdefault(r["provider"], []).append(r)
    notes = []
    for prov, rs in provs.items():
        ages = [x["days"] for x in rs if x["days"] is not None]
        seen = ("last seen %dd ago" % min(ages)) if ages else "age unknown"
        hit = ", ".join(sorted({x["skill"] for x in rs}))
        notes.append((prov, len(rs), hit, seen))
    return notes


def render_text():
    L = []
    L.append("skills.sh audits for %s/%s  (stale marker: > %dd)" % (owner, repo, stale_days))
    L.append("")
    by_skill = OrderedDict((s, []) for s in skills)
    for r in records:
        by_skill[r["skill"]].append(r)
    for skill in skills:
        L.append("=== %s ===" % skill)
        recs = by_skill.get(skill) or []
        if not recs:
            L.append("  (%s)" % no_data.get(skill, "no audits"))
            L.append("")
            continue
        s_warn = s_fail = 0
        s_worst = None
        for r in recs:
            age = ""
            if r["days"] is not None:
                flag = "  [STALE >%dd]" % stale_days if r["stale"] else ""
                age = "  (%dd ago)%s" % (r["days"], flag)
            tag = "  [retired/inactive - excluded]" if r["retired"] else ""
            L.append("  %-22s %-5s %-7s %s%s%s" % (
                r["provider"], r["status"], r["risk_raw"], fmt_when(r), age, tag))
            if r["retired"]:
                continue
            if r["categories"]:
                L.append("       categories: %s" % ", ".join(r["categories"]))
            if r["summary"]:
                summ = r["summary"]
                if len(summ) > 400:
                    summ = summ[:397] + "..."
                L.append(textwrap.fill(summ, width=92,
                         initial_indent="       ", subsequent_indent="       "))
            if r["status"] == "WARN":
                s_warn += 1
            elif r["status"] == "FAIL":
                s_fail += 1
            if r["risk"] in ORDER and (s_worst is None or ORDER[r["risk"]] > ORDER.get(s_worst, -1)):
                s_worst = r["risk"]
        L.append("  -> worst risk: %s   (%d warn / %d fail)" % (s_worst or "n/a", s_warn, s_fail))
        L.append("")
    L.append("== overall (active providers) ==")
    L.append("  worst risk: %s   (%d warn / %d fail, %d HIGH)" % (worst or "n/a", warn, fail, high_count))
    if retired_recs:
        notes = ["%s (%d findings, %s)" % (p, n, seen) for p, n, _hit, seen in retired_notes()]
        L.append("  excluded (retired/inactive): %s" % "; ".join(notes))
    if fail_on in ORDER:
        if triggered:
            names = ", ".join("%s/%s" % (r["skill"], r["provider"]) for r in triggered)
            L.append("  ALERT: %d active finding(s) at >= %s -> %s" % (len(triggered), fail_on, names))
        else:
            L.append("  alert threshold %s: clear" % fail_on)
    L.append("")
    return "\n".join(L)


STATUS_EMOJI = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}
RISK_EMOJI = {"HIGH": "🔴", "MEDIUM": "🟠", "LOW": "🟡", "SAFE": "🟢"}


def md_cell(s):
    return str(s).replace("|", "\\|").replace("\n", " ").strip()


def md_text(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_markdown():
    L = []
    L.append("## skills.sh security audit — %s/%s" % (owner, repo))
    L.append("")
    badge = RISK_EMOJI.get(worst, "⚪")
    L.append("**Worst active risk: %s %s** · %d HIGH · %d WARN / %d FAIL · stale marker > %dd"
             % (badge, worst or "n/a", high_count, warn, fail, stale_days))
    if fail_on in ORDER:
        L.append("")
        if triggered:
            names = ", ".join("`%s` / %s" % (r["skill"], r["provider"]) for r in triggered)
            L.append("> 🔴 **ALERT — %d active finding(s) at or above %s:** %s"
                     % (len(triggered), fail_on, names))
        else:
            L.append("> ✅ Alert threshold **%s** clear — no active finding at or above it." % fail_on)
    L.append("")
    L.append("| Skill | Provider | Status | Risk | Audited | Age |")
    L.append("|-------|----------|:------:|:----:|---------|-----|")
    for r in active:
        st = ("%s %s" % (STATUS_EMOJI.get(r["status"], ""), r["status"])).strip()
        rk = "%s %s" % (RISK_EMOJI[r["risk"]], r["risk_raw"]) if r["risk"] in RISK_EMOJI else r["risk_raw"]
        if r["days"] is None:
            age = "—"
        else:
            age = "%dd%s" % (r["days"], " 🕒" if r["stale"] else "")
        L.append("| %s | %s | %s | %s | %s | %s |" % (
            md_cell(r["skill"]), md_cell(r["provider"]), st, rk, md_cell(fmt_when(r)), age))
    L.append("")
    if no_data:
        items = ", ".join("`%s` (%s)" % (s, reason) for s, reason in no_data.items())
        L.append("_No audit data: %s_" % items)
        L.append("")
    detailed = [r for r in active if r["categories"] or r["summary"]]
    if detailed:
        L.append("<details>")
        L.append("<summary>Finding details &amp; summaries</summary>")
        L.append("")
        for r in detailed:
            head = "**%s · %s**" % (r["skill"], r["provider"])
            if r["categories"]:
                head += " — " + ", ".join("`%s`" % c for c in r["categories"])
            L.append(head)
            L.append("")
            if r["summary"]:
                L.append("> " + md_text(r["summary"]))
                L.append("")
        L.append("</details>")
        L.append("")
    if retired_recs:
        notes = ["**%s** — %d finding(s) on %s, %s" % (p, n, hit, seen)
                 for p, n, hit, seen in retired_notes()]
        L.append("> ℹ️ **Excluded as retired/inactive** (not in the rollup or the alert): "
                 + "; ".join(notes)
                 + ". skills.sh no longer runs these on freshly re-scanned skills.")
        L.append("")
    return "\n".join(L)


def render_json():
    out = []
    for idx, skill in enumerate(skills):
        data = load(idx)
        if isinstance(data, dict):
            out.append({"skill": skill, "audits": data.get("audits")})
        else:
            out.append({"skill": skill, "audits": None})
    return json.dumps(out, indent=2)


if mode == "json":
    print(render_json())
    sys.exit(0)
elif mode == "markdown":
    sys.stdout.write(render_markdown() + "\n")
else:
    sys.stdout.write(render_text() + "\n")

sys.exit(1 if (fail_on in ORDER and triggered) else 0)
PY
exit 0
