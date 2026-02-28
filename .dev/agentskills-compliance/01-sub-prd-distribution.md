# Sub-PRD: Script & Agent Distribution

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Not Started
**Dependency**: None
**Last Updated**: 2026-02-28

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Create `scripts/` directories in each skill | ⬜ Not Started |
| **2** | Copy scripts into skill directories | ⬜ Not Started |
| **3** | Create `agents/` directories in applicable skills | ⬜ Not Started |
| **4** | Copy agents into skill directories | ⬜ Not Started |

---

## Goal

Place all script and agent files inside the skill directories that use them. This phase makes no deletions and no reference changes — the shared directories remain intact so existing tests and SKILL.md references keep working.

---

## Implementation Steps

### Step 1: Create `scripts/` directories

Create `scripts/` inside each of the 5 skill directories:
```
plugins/dev-workflow/skills/dev-plan/scripts/
plugins/dev-workflow/skills/dev-checkpoint/scripts/
plugins/dev-workflow/skills/dev-resume/scripts/
plugins/dev-workflow/skills/dev-status/scripts/
plugins/dev-workflow/skills/dev-wrapup/scripts/
```

### Step 2: Copy scripts into skill directories

Copy each script only into the skills that use it:

| Script | Copy to |
|--------|---------|
| `discover.sh` | dev-plan, dev-checkpoint, dev-resume, dev-status, dev-wrapup (all 5) |
| `validate.sh` | dev-plan, dev-checkpoint, dev-resume, dev-status (4 skills) |
| `git-state.sh` | dev-checkpoint, dev-resume (2 skills) |
| `worktree-setup.sh` | dev-checkpoint (1 skill) |

Preserve execute permissions (`cp -p`).

### Step 3: Create `agents/` directories

Create `agents/` inside the 4 skills that use agents (not dev-wrapup):
```
plugins/dev-workflow/skills/dev-plan/agents/
plugins/dev-workflow/skills/dev-checkpoint/agents/
plugins/dev-workflow/skills/dev-resume/agents/
plugins/dev-workflow/skills/dev-status/agents/
```

### Step 4: Copy agents into skill directories

| Agent | Copy to |
|-------|---------|
| `prd-researcher.md` | dev-plan |
| `prd-planner.md` | dev-plan |
| `checkpoint-analyzer.md` | dev-checkpoint |
| `context-loader.md` | dev-resume |
| `feature-batch-scanner.md` | dev-status |

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `plugins/dev-workflow/skills/dev-plan/scripts/discover.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-plan/scripts/validate.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-checkpoint/scripts/discover.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-checkpoint/scripts/validate.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-checkpoint/scripts/git-state.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-checkpoint/scripts/worktree-setup.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-resume/scripts/discover.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-resume/scripts/validate.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-resume/scripts/git-state.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-status/scripts/discover.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-status/scripts/validate.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-wrapup/scripts/discover.sh` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-plan/agents/prd-researcher.md` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-plan/agents/prd-planner.md` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-checkpoint/agents/checkpoint-analyzer.md` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-resume/agents/context-loader.md` | Skill-local copy |
| `plugins/dev-workflow/skills/dev-status/agents/feature-batch-scanner.md` | Skill-local copy |

---

## Verification Checklist

- [ ] `ls plugins/dev-workflow/skills/dev-plan/scripts/` shows `discover.sh validate.sh`
- [ ] `ls plugins/dev-workflow/skills/dev-checkpoint/scripts/` shows `discover.sh git-state.sh validate.sh worktree-setup.sh`
- [ ] `ls plugins/dev-workflow/skills/dev-resume/scripts/` shows `discover.sh git-state.sh validate.sh`
- [ ] `ls plugins/dev-workflow/skills/dev-status/scripts/` shows `discover.sh validate.sh`
- [ ] `ls plugins/dev-workflow/skills/dev-wrapup/scripts/` shows `discover.sh`
- [ ] `ls plugins/dev-workflow/skills/dev-plan/agents/` shows `prd-planner.md prd-researcher.md`
- [ ] `ls plugins/dev-workflow/skills/dev-checkpoint/agents/` shows `checkpoint-analyzer.md`
- [ ] `ls plugins/dev-workflow/skills/dev-resume/agents/` shows `context-loader.md`
- [ ] `ls plugins/dev-workflow/skills/dev-status/agents/` shows `feature-batch-scanner.md`
- [ ] `dev-wrapup/` has no `agents/` directory
- [ ] All copied scripts have execute permission
- [ ] Run: `bash tests/test-scripts.sh` — still passes (shared dir unchanged)

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
