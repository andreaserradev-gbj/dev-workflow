# AgentSkills Compliance - Master Plan

**Status**: Complete
**Created**: 2026-02-28
**Last Updated**: 2026-02-28

---

## Executive Summary

Refactor the dev-workflow plugin's skill structure so each skill is fully self-contained per the AgentSkills.io specification. Currently, shared scripts (`discover.sh`, `validate.sh`, `git-state.sh`, `worktree-setup.sh`) live at the plugin root in `scripts/`, and agent definitions live in `agents/` — both outside skill directories. The spec expects `scripts/` and `references/` inside each skill directory, with file references kept one level deep from `SKILL.md`.

This is a pure structural refactoring. No behavior changes — only file locations and path references.

---

## Research Findings

### Codebase Patterns
- Scripts use `../../scripts/X.sh` markdown links in SKILL.md, then resolve absolute paths at runtime via `$DISCOVER`, `$VALIDATE`, etc.
- Each agent maps 1:1 to a single skill (no sharing)
- Scripts are self-contained (no inter-script dependencies)
- `references/` directories in `dev-plan` and `dev-checkpoint` are already spec-compliant

### Dependencies
- `discover.sh` — used by all 5 skills
- `validate.sh` — used by 4 skills (dev-plan, dev-checkpoint, dev-resume, dev-status)
- `git-state.sh` — used by 2 skills (dev-checkpoint, dev-resume)
- `worktree-setup.sh` — used by 1 skill (dev-checkpoint)
- Claude Code agent auto-discovery only scans `<plugin-root>/agents/` unless `plugin.json` declares explicit paths

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Copy scripts into each skill (duplication) | Symlinks don't survive plugin cache; build steps add friction | Symlinks (cache breaks them), build step (extra workflow), shared dir (not spec-compliant) |
| Add `agents` array to `plugin.json` | Claude Code only auto-discovers from `agents/` at plugin root; per-skill paths need explicit registration | Keep agents at plugin root (not self-contained), symlinks (same cache issue) |
| Checksum sync test for duplicated scripts | Catches drift on pre-commit without build-step complexity | Manual review (error-prone), build step (over-engineered) |
| Use `dev-checkpoint/scripts/` as canonical test source | It's the only skill that has all 4 scripts | Any other skill (would miss some scripts) |

### Constraints

- **Reuse**: Existing `test-scripts.sh` harness (`run_test`/`run_test_empty` functions)
- **Patterns to follow**: `references/` placement in `dev-plan` and `dev-checkpoint` (already compliant)
- **Avoid**: Symlinks (don't survive plugin cache), inter-script dependencies, deeply nested reference chains

---

## Architecture Decision

**Approach**: Duplicate scripts into each skill's `scripts/` directory, move agents into each skill's `agents/` directory, register per-skill agent paths in `plugin.json`, add a checksum sync test to prevent drift.

Each skill becomes a self-contained unit:
```
skill-name/
  SKILL.md
  scripts/         (only the scripts this skill uses)
  agents/          (only the agents this skill owns, if any)
  references/      (existing, unchanged)
```

---

## Sub-PRD Overview

| Sub-PRD | Title | Dependency | Status | Document |
|---------|-------|------------|--------|----------|
| **1** | Script & Agent Distribution | None | ✅ Done | [01-sub-prd-distribution.md](./01-sub-prd-distribution.md) |
| **2** | SKILL.md & plugin.json Updates | 1 | ✅ Done | [02-sub-prd-skill-updates.md](./02-sub-prd-skill-updates.md) |
| **3** | Test Migration & Cleanup | 2 | ✅ Done | [03-sub-prd-test-cleanup.md](./03-sub-prd-test-cleanup.md) |

---

## Implementation Order

### Phase 1: Script & Agent Distribution
**Goal**: Copy all scripts and agents into their owning skill directories. No deletions, no reference changes.

1. ✅ Copy scripts into each skill's `scripts/` directory
2. ✅ Copy agents into each skill's `agents/` directory

**Verification**:
- [x] Each skill has exactly the scripts/agents it needs
- [x] Run: `bash tests/test-scripts.sh` — passes (still using shared dir)

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: SKILL.md & plugin.json Updates
**Goal**: Repoint all path references and register agent paths.

1. ✅ Update all 5 SKILL.md files: `../../scripts/` → `scripts/`, agent prose, description triggers
2. ✅ Add `agents` array to `plugin.json`

**Verification**:
- [x] `grep -r "../../scripts" plugins/dev-workflow/skills/` returns nothing
- [x] `plugin.json` is valid JSON with all 5 agent paths
- [x] Run: `bash tests/test-scripts.sh` — passes

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 3: Test Migration & Cleanup
**Goal**: Repoint tests, add sync guard, delete shared directories, update docs, bump version.

1. ✅ Repoint `SCRIPT_DIR` in `test-scripts.sh` to `skills/dev-checkpoint/scripts/`
2. ✅ Add checksum sync test
3. ✅ Delete `plugins/dev-workflow/scripts/` and `plugins/dev-workflow/agents/`
4. ✅ Update CLAUDE.md repository structure
5. ✅ Bump version in `marketplace.json` to 1.9.0

**Verification**:
- [x] Run: `bash tests/test-scripts.sh` — all tests pass including sync
- [x] Shared `scripts/` and `agents/` directories no longer exist
- [x] `marketplace.json` version is 1.9.0

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

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

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/skills/dev-plan/SKILL.md` | Path refs, agent prose, description trigger |
| `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` | Path refs, agent prose, description trigger |
| `plugins/dev-workflow/skills/dev-resume/SKILL.md` | Path refs, description trigger |
| `plugins/dev-workflow/skills/dev-status/SKILL.md` | Path refs, agent prose, description trigger |
| `plugins/dev-workflow/skills/dev-wrapup/SKILL.md` | Path refs, description trigger |
| `plugins/dev-workflow/.claude-plugin/plugin.json` | Add `agents` array |
| `tests/test-scripts.sh` | Repoint SCRIPT_DIR, add sync test |
| `CLAUDE.md` | Update repository structure |
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

## Reference Files

- `plugins/dev-workflow/scripts/*.sh`: Source scripts to copy
- `plugins/dev-workflow/agents/*.md`: Source agent definitions to copy
- `tests/test-scripts.sh`: Test harness to update
