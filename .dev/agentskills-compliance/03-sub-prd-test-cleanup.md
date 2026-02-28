# Sub-PRD: Test Migration & Cleanup

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Not Started
**Dependency**: 02-sub-prd-skill-updates.md
**Last Updated**: 2026-02-28

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Repoint SCRIPT_DIR in test-scripts.sh | ⬜ Not Started |
| **2** | Add checksum sync test | ⬜ Not Started |
| **3** | Delete shared scripts/ directory | ⬜ Not Started |
| **4** | Delete shared agents/ directory | ⬜ Not Started |
| **5** | Update CLAUDE.md repository structure | ⬜ Not Started |
| **6** | Bump version in marketplace.json | ⬜ Not Started |

---

## Goal

Repoint the test suite to use per-skill script locations, add a sync guard that catches drift between script copies, delete the now-redundant shared directories, update documentation, and bump the plugin version.

---

## Implementation Steps

### Step 1: Repoint `SCRIPT_DIR`

**File**: `tests/test-scripts.sh`

Change line 4 from:
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")/../plugins/dev-workflow/scripts" && pwd)"
```
to:
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")/../plugins/dev-workflow/skills/dev-checkpoint/scripts" && pwd)"
```

`dev-checkpoint` is the canonical source because it's the only skill with all 4 scripts.

### Step 2: Add checksum sync test

**File**: `tests/test-scripts.sh`

Add a new test section `--- script sync ---` after the existing tests. Use `shasum -a 256` (macOS) to verify all copies of each script are identical.

Scripts to sync-check:
- `discover.sh` — 5 copies (dev-plan, dev-checkpoint, dev-resume, dev-status, dev-wrapup)
- `validate.sh` — 4 copies (dev-plan, dev-checkpoint, dev-resume, dev-status)
- `git-state.sh` — 2 copies (dev-checkpoint, dev-resume)
- `worktree-setup.sh` — 1 copy (dev-checkpoint only, no sync needed)

Approach: for each script, compute the checksum of the canonical copy (dev-checkpoint), then compare against all other copies. Fail with a descriptive message if any differ.

```bash
# Pseudocode for sync test
SKILLS_DIR="$(cd "$(dirname "$0")/../plugins/dev-workflow/skills" && pwd)"

check_sync() {
  local script="$1"
  shift
  local canonical="$SKILLS_DIR/dev-checkpoint/scripts/$script"
  local canonical_hash
  canonical_hash="$(shasum -a 256 "$canonical" | cut -d' ' -f1)"
  for skill in "$@"; do
    local copy="$SKILLS_DIR/$skill/scripts/$script"
    local copy_hash
    copy_hash="$(shasum -a 256 "$copy" | cut -d' ' -f1)"
    if [ "$canonical_hash" != "$copy_hash" ]; then
      # fail with message identifying which copy diverged
    fi
  done
}

check_sync discover.sh dev-plan dev-resume dev-status dev-wrapup
check_sync validate.sh dev-plan dev-resume dev-status
check_sync git-state.sh dev-resume
```

Use the existing `run_test` harness style for output formatting.

### Step 3: Delete shared `scripts/` directory

```bash
rm -rf plugins/dev-workflow/scripts/
```

This removes: `discover.sh`, `validate.sh`, `git-state.sh`, `worktree-setup.sh`

### Step 4: Delete shared `agents/` directory

```bash
rm -rf plugins/dev-workflow/agents/
```

This removes: `prd-researcher.md`, `prd-planner.md`, `checkpoint-analyzer.md`, `context-loader.md`, `feature-batch-scanner.md`

### Step 5: Update CLAUDE.md

**File**: `CLAUDE.md`

Update the repository structure section to reflect the new layout. Replace the `scripts/` and `agents/` entries at the plugin level with per-skill entries. New structure:

```
plugins/dev-workflow/
  .claude-plugin/
    plugin.json
  skills/
    dev-plan/
      SKILL.md
      references/prd-templates.md
      scripts/discover.sh, validate.sh
      agents/prd-researcher.md, prd-planner.md
    dev-checkpoint/
      SKILL.md
      references/checkpoint-template.md
      scripts/discover.sh, validate.sh, git-state.sh, worktree-setup.sh
      agents/checkpoint-analyzer.md
    dev-resume/
      SKILL.md
      scripts/discover.sh, validate.sh, git-state.sh
      agents/context-loader.md
    dev-status/
      SKILL.md
      scripts/discover.sh, validate.sh
      agents/feature-batch-scanner.md
    dev-wrapup/
      SKILL.md
      scripts/discover.sh
```

### Step 6: Bump version

**File**: `.claude-plugin/marketplace.json`

Bump `version` from `1.8.0` to `1.9.0`.

---

## Files Changed

### Modified Files

| File | Changes |
|------|---------|
| `tests/test-scripts.sh` | Repoint SCRIPT_DIR, add sync checksum test section |
| `CLAUDE.md` | Update repository structure to show per-skill layout |
| `.claude-plugin/marketplace.json` | Bump version to 1.9.0 |

### Deleted Files

| File | Reason |
|------|--------|
| `plugins/dev-workflow/scripts/discover.sh` | Replaced by per-skill copies |
| `plugins/dev-workflow/scripts/validate.sh` | Replaced by per-skill copies |
| `plugins/dev-workflow/scripts/git-state.sh` | Replaced by per-skill copies |
| `plugins/dev-workflow/scripts/worktree-setup.sh` | Replaced by per-skill copies |
| `plugins/dev-workflow/agents/prd-researcher.md` | Replaced by per-skill copy |
| `plugins/dev-workflow/agents/prd-planner.md` | Replaced by per-skill copy |
| `plugins/dev-workflow/agents/checkpoint-analyzer.md` | Replaced by per-skill copy |
| `plugins/dev-workflow/agents/context-loader.md` | Replaced by per-skill copy |
| `plugins/dev-workflow/agents/feature-batch-scanner.md` | Replaced by per-skill copy |

---

## Verification Checklist

- [ ] Run: `bash tests/test-scripts.sh` — all tests pass including sync checks
- [ ] `ls plugins/dev-workflow/scripts/` — directory does not exist
- [ ] `ls plugins/dev-workflow/agents/` — directory does not exist
- [ ] Manually corrupt one script copy (e.g., add a comment to `dev-plan/scripts/discover.sh`), run tests, confirm sync test fails, then restore
- [ ] `grep "1.9.0" .claude-plugin/marketplace.json` — returns a match
- [ ] CLAUDE.md repository structure matches the new layout

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
