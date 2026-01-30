---
branch: feature/commands-to-skills
last_commit: 10e5695 Migrate from commands/ to skills/ format
uncommitted_changes: true
checkpointed: 2026-01-29T22:10:00Z
---

Read the following PRD files in order:

1. .dev/commands-to-skills/00-master-plan.md

<context>
## Context

**Goal**: Migrate dev-workflow plugin from commands/ to skills/ format
**Current phase**: Phase 6 (Merge) — blocked on upstream bug
**Key completions**: All skills migrated, templates extracted, commands/ deleted
</context>

<current_state>
## Current Progress

- ✅ Phase 1-5: All migration work complete
- ✅ Skills load correctly (visible in `/skills`, execute when typed manually)
- ⬜ Phase 6: Merge blocked pending bug fix
</current_state>

<next_action>
## Next Steps

After bug #20998 is fixed:
1. Test autocomplete works for `/dev-workflow:dev-plan`, `/dev-workflow:dev-checkpoint`, `/dev-workflow:dev-resume`
2. Complete Phase 6 merge tasks:
   - Review diff: `git diff main..feature/commands-to-skills`
   - Merge branch to main
   - Delete feature branch
   - Tag release `v1.2.0`
</next_action>

<key_files>
## Key Files

- Master Plan: .dev/commands-to-skills/00-master-plan.md
- dev-plan skill: skills/dev-plan/SKILL.md
- dev-checkpoint skill: skills/dev-checkpoint/SKILL.md
- dev-resume skill: skills/dev-resume/SKILL.md
- Plugin manifest: .claude-plugin/marketplace.json
</key_files>

<blockers>
## Blockers / Gotchas

- **Claude Code bug #20998**: Plugin skills don't appear in autocomplete (reported 2026-01-26, status: OPEN)
  - Skills ARE loaded and work when typed manually
  - Issue: https://github.com/anthropics/claude-code/issues/20998
  - Workaround: Type full command `/dev-workflow:dev-plan` without autocomplete
</blockers>

<decisions>
## Decisions

1. Keep skills/ format (not reverting to commands/) — bug will be fixed upstream
2. Branch kept locally until bug is resolved
3. Uncommitted changes: added `user-invocable: true` to SKILL.md files (testing)
</decisions>

---

Please continue by checking if bug #20998 has been fixed, then complete Phase 6 merge tasks.
