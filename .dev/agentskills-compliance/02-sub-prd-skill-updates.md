# Sub-PRD: SKILL.md & plugin.json Updates

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Complete
**Dependency**: 01-sub-prd-distribution.md
**Last Updated**: 2026-02-28

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Update dev-plan/SKILL.md | ✅ Done |
| **2** | Update dev-checkpoint/SKILL.md | ✅ Done |
| **3** | Update dev-resume/SKILL.md | ✅ Done |
| **4** | Update dev-status/SKILL.md | ✅ Done |
| **5** | Update dev-wrapup/SKILL.md | ✅ Done |
| **6** | Update plugin.json with agent paths | ✅ Done |

---

## Goal

Repoint all SKILL.md path references from `../../scripts/` to `scripts/` (one level deep, spec-compliant). Update agent location prose. Add "when to use it" trigger phrases to descriptions. Register per-skill agent paths in `plugin.json`.

---

## Implementation Steps

### Step 1: Update `dev-plan/SKILL.md`

**File**: `plugins/dev-workflow/skills/dev-plan/SKILL.md`

Changes:
1. **Description**: Add trigger phrase (e.g., "Use when starting a new feature, spike, or major task")
2. **Script links**: Change `[discovery script](../../scripts/discover.sh)` to `[discovery script](scripts/discover.sh)` and same for `validate.sh`
3. **Variable prose**: Change "absolute path to `scripts/X.sh` within the plugin directory" to "absolute path to `scripts/X.sh` within this skill's directory" (or "within the skill directory")
4. **Agent prose**: Change "Agent definitions are in `plugins/dev-workflow/agents/`" to "Agent definitions are in `agents/` within this skill directory"

### Step 2: Update `dev-checkpoint/SKILL.md`

**File**: `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md`

Changes:
1. **Description**: Add trigger phrase (e.g., "Use at the end of a session or before switching context")
2. **Script links**: Change all 4 `../../scripts/*.sh` references to `scripts/*.sh` (discover.sh, validate.sh, git-state.sh, worktree-setup.sh)
3. **Variable prose**: Update all 4 variable resolution instructions ("plugin directory" to "skill directory")

### Step 3: Update `dev-resume/SKILL.md`

**File**: `plugins/dev-workflow/skills/dev-resume/SKILL.md`

Changes:
1. **Description**: Add trigger phrase (e.g., "Use at the start of a new session to restore context from a previous checkpoint")
2. **Script links**: Change all 3 `../../scripts/*.sh` references to `scripts/*.sh` (discover.sh, validate.sh, git-state.sh)
3. **Variable prose**: Update all 3 variable resolution instructions

### Step 4: Update `dev-status/SKILL.md`

**File**: `plugins/dev-workflow/skills/dev-status/SKILL.md`

Changes:
1. **Description**: Add trigger phrase (e.g., "Use to get an overview of all in-progress features and their completion status")
2. **Script links**: Change all 2 `../../scripts/*.sh` references to `scripts/*.sh` (discover.sh, validate.sh)
3. **Variable prose**: Update both variable resolution instructions
4. **Agent prose**: Change "Agent definition is in `plugins/dev-workflow/agents/`" to "Agent definition is in `agents/` within this skill directory"

### Step 5: Update `dev-wrapup/SKILL.md`

**File**: `plugins/dev-workflow/skills/dev-wrapup/SKILL.md`

Changes:
1. **Description**: Add trigger phrase (e.g., "Use after completing work to review the session for learnings and improvement signals")
2. **Script links**: Change `../../scripts/discover.sh` to `scripts/discover.sh`
3. **Variable prose**: Update the `$DISCOVER` resolution instruction

### Step 6: Update `plugin.json`

**File**: `plugins/dev-workflow/.claude-plugin/plugin.json`

Add `agents` array listing all 5 per-skill agent paths:
```json
{
  "name": "dev-workflow",
  "author": { "name": "Andrea Serra" },
  "description": "Plan features with structured PRDs, checkpoint progress, and resume across sessions.",
  "agents": [
    "skills/dev-plan/agents/prd-researcher.md",
    "skills/dev-plan/agents/prd-planner.md",
    "skills/dev-checkpoint/agents/checkpoint-analyzer.md",
    "skills/dev-resume/agents/context-loader.md",
    "skills/dev-status/agents/feature-batch-scanner.md"
  ]
}
```

---

## Files Changed

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/skills/dev-plan/SKILL.md` | Path refs `../../scripts/` → `scripts/`, agent prose, description trigger |
| `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` | Path refs for 4 scripts, description trigger |
| `plugins/dev-workflow/skills/dev-resume/SKILL.md` | Path refs for 3 scripts, description trigger |
| `plugins/dev-workflow/skills/dev-status/SKILL.md` | Path refs for 2 scripts, agent prose, description trigger |
| `plugins/dev-workflow/skills/dev-wrapup/SKILL.md` | Path ref for 1 script, description trigger |
| `plugins/dev-workflow/.claude-plugin/plugin.json` | Add `agents` array |

---

## Verification Checklist

- [ ] `grep -r "../../scripts" plugins/dev-workflow/skills/` returns no output
- [ ] `grep -r "plugins/dev-workflow/agents/" plugins/dev-workflow/skills/` returns no output
- [ ] All 5 SKILL.md descriptions contain a "Use when" or similar trigger phrase
- [ ] `python3 -m json.tool plugins/dev-workflow/.claude-plugin/plugin.json` validates successfully
- [ ] All 5 paths in the `agents` array exist on disk relative to `plugins/dev-workflow/`
- [ ] Run: `bash tests/test-scripts.sh` — still passes

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
