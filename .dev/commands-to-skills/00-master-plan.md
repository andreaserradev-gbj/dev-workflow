# Commands to Skills Migration - Master Plan

**Status**: Blocked (Plugin skill autocomplete bug #20998)
**Created**: 2026-01-29
**Last Updated**: 2026-01-29

---

## Executive Summary

Migrate the dev-workflow plugin from the legacy `commands/` format to the modern `skills/` format. This enables supporting files for PRD templates, proper frontmatter configuration with `disable-model-invocation: true`, and better organization with templates extracted to separate files.

The migration preserves all existing functionality while adopting the recommended plugin structure from Claude Code documentation.

**Reference**: https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/plugins

---

## Research Findings

### Codebase Patterns
- **Frontmatter**: Current commands use `description`, `version`, `output`, `reads` — maps directly to skill frontmatter
- **Step 0 pattern**: Project root detection duplicated in all 3 commands — document once per skill
- **Templates inline**: Master Plan (~100 lines), Sub-PRD (~60 lines), Checkpoint (~70 lines) — extract to files
- **Contract spec**: "CHECKPOINT COMPATIBILITY" section defines inter-command contract — reference from SKILL.md

### Dependencies
- **Claude Code 1.0.33+**: Required for `/plugin` command and skills support
- **Plugin structure**: `.claude-plugin/plugin.json` (or `marketplace.json`) remains at plugin root
- **Backward compatibility**: `commands/` still works but skills take precedence if same name

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Extract templates to separate files | Keeps SKILL.md under 500 lines; templates referenceable | Keep inline (current) |
| Each skill self-contained | No cross-skill dependencies; simpler maintenance | Shared `docs/` folder at plugin root |
| `disable-model-invocation: true` | These are explicit user workflows, not auto-triggered | Allow auto-invocation |
| Delete `commands/` after migration | Avoid duplication; skills take precedence anyway | Keep for backward compat |

---

## Architecture Decision

**Approach**: Three separate skill directories, each self-contained with templates as supporting files

```
dev-workflow/
├── .claude-plugin/
│   └── marketplace.json          # unchanged
├── skills/
│   ├── dev-plan/
│   │   ├── SKILL.md              # core instructions (~150 lines)
│   │   ├── master-plan-template.md
│   │   └── sub-prd-template.md
│   ├── dev-checkpoint/
│   │   ├── SKILL.md              # core instructions (~130 lines)
│   │   └── checkpoint-template.md
│   └── dev-resume/
│       └── SKILL.md              # core instructions (~90 lines)
├── README.md                     # update installation instructions
└── LICENSE
```

Skills are invoked as `/dev-workflow:dev-plan`, `/dev-workflow:dev-checkpoint`, `/dev-workflow:dev-resume` (same as current commands).

---

## Implementation Order

### Phase 1: Setup
**Goal**: Create branch and skill directory structure

1. ✅ Create git branch `feature/commands-to-skills`
2. ✅ Create `skills/` directory structure with subdirectories for each skill
3. ✅ Verify structure with `ls -la skills/*/`

**Verification**: Directory structure matches architecture diagram

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 2: Migrate dev-plan
**Goal**: Convert dev-plan command to skill format with extracted templates

1. ✅ Extract Master Plan template from `commands/dev-plan.md` to `skills/dev-plan/master-plan-template.md`
2. ✅ Extract Sub-PRD template to `skills/dev-plan/sub-prd-template.md`
3. ✅ Create `skills/dev-plan/SKILL.md` with:
   - Frontmatter: `name`, `description`, `disable-model-invocation: true`
   - Core instructions (phases 1-3, rules)
   - References to template files
   - CHECKPOINT COMPATIBILITY section (kept inline as reference)
4. ⬜ Test with `claude --plugin-dir .` and run `/dev-workflow:dev-plan`

**Verification**: `/dev-workflow:dev-plan` produces PRD using templates from supporting files

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 3: Migrate dev-checkpoint
**Goal**: Convert dev-checkpoint command to skill format

1. ✅ Extract checkpoint continuation prompt template to `skills/dev-checkpoint/checkpoint-template.md`
2. ✅ Create `skills/dev-checkpoint/SKILL.md` with:
   - Frontmatter: `name`, `description`, `disable-model-invocation: true`
   - Steps 0-7 (core instructions)
   - Reference to checkpoint template
3. ✅ Test with `claude --plugin-dir .` and run `/dev-workflow:dev-checkpoint`

**Verification**: `/dev-workflow:dev-checkpoint` creates checkpoint.md using template

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 4: Migrate dev-resume
**Goal**: Convert dev-resume command to skill format

1. ✅ Create `skills/dev-resume/SKILL.md` with:
   - Frontmatter: `name`, `description`, `disable-model-invocation: true`
   - Steps 0-6 (core instructions)
   - Resumption summary template (inline — only ~10 lines)
   - Discrepancy handling table
2. ⬜ Test with `claude --plugin-dir .` and run `/dev-workflow:dev-resume`

**Verification**: `/dev-workflow:dev-resume` loads checkpoint and presents summary

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 5: Cleanup and Documentation
**Goal**: Remove legacy files and update documentation

1. ✅ Delete `commands/` directory
2. ✅ Update `README.md`:
   - Installation instructions remain the same (plugin format)
   - Note that skills format is now used internally
3. ✅ Update `.claude-plugin/marketplace.json` version to `1.2.0`
4. ⬜ Full integration test: `/dev-plan` → build → `/dev-checkpoint` → restart → `/dev-resume`
5. ✅ Commit changes to branch

**Verification**: Full workflow cycle works; no references to `commands/` remain

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 6: Merge
**Goal**: Merge to main after verification

1. ⬜ Review diff: `git diff main..feature/commands-to-skills`
2. ⬜ Merge branch to main
3. ⬜ Delete feature branch
4. ⬜ Tag release `v1.2.0`

**Verification**: Main branch has skills structure; plugin works when installed from marketplace

⏸️ **GATE**: Migration complete.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `skills/dev-plan/SKILL.md` | Core planning instructions with frontmatter |
| `skills/dev-plan/master-plan-template.md` | PRD master plan template (~100 lines) |
| `skills/dev-plan/sub-prd-template.md` | Sub-PRD template (~60 lines) |
| `skills/dev-checkpoint/SKILL.md` | Core checkpoint instructions |
| `skills/dev-checkpoint/checkpoint-template.md` | Continuation prompt template (~70 lines) |
| `skills/dev-resume/SKILL.md` | Core resume instructions |

### Modified Files

| File | Changes |
|------|---------|
| `README.md` | Update to note skills format (installation unchanged) |
| `.claude-plugin/marketplace.json` | Bump version to 1.2.0 |

### Deleted Files

| File | Reason |
|------|--------|
| `commands/dev-plan.md` | Replaced by skill |
| `commands/dev-checkpoint.md` | Replaced by skill |
| `commands/dev-resume.md` | Replaced by skill |

---

## Reference Files

- `commands/dev-plan.md`: Source for dev-plan skill and templates
- `commands/dev-checkpoint.md`: Source for dev-checkpoint skill and template
- `commands/dev-resume.md`: Source for dev-resume skill
- https://code.claude.com/docs/en/skills: Official skills documentation
- https://code.claude.com/docs/en/plugins: Official plugins documentation
