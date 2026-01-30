---
branch: feature/commands-to-skills
last_commit: b17c83c Add CLAUDE.md, user-invocable frontmatter, and .dev/ example
uncommitted_changes: false
checkpointed: 2026-01-30T10:45:00Z
---

Read the following PRD files in order:

1. .dev/commands-to-skills/00-master-plan.md

<context>
## Context

**Goal**: Migrate dev-workflow plugin from commands/ to skills/ format
**Current phase**: Phase 6 (Merge) — PR open, blocked on upstream bug
**Key completions**: All skills migrated, PR #1 created with dogfooding showcase
</context>

<current_state>
## Current Progress

- ✅ Phase 1-5: All migration work complete
- ✅ Branch pushed to GitHub
- ✅ PR #1 created: https://github.com/andreaserradev-gbj/dev-workflow/pull/1
- ⬜ Phase 6: Merge blocked pending bug #20998 fix
</current_state>

<next_action>
## Next Steps

After bug #20998 is fixed:
1. Test autocomplete works for `/dev-workflow:dev-plan`, `/dev-workflow:dev-checkpoint`, `/dev-workflow:dev-resume`
2. Complete Phase 6 merge tasks:
   - Review diff: `git diff main..feature/commands-to-skills`
   - Merge PR #1 to main
   - Delete feature branch
   - Tag release `v1.2.0`
3. Delete `.claude-plugin/plugin.json` (local testing file)
</next_action>

<key_files>
## Key Files

- Master Plan: .dev/commands-to-skills/00-master-plan.md
- dev-plan skill: skills/dev-plan/SKILL.md
- dev-checkpoint skill: skills/dev-checkpoint/SKILL.md
- dev-resume skill: skills/dev-resume/SKILL.md
- Plugin manifest: .claude-plugin/marketplace.json
- PR: https://github.com/andreaserradev-gbj/dev-workflow/pull/1
</key_files>

<decisions>
## Decisions

1. Include `.dev/` folder in PR as dogfooding showcase
2. Include `CLAUDE.md` for repository guidance
3. Keep `plugin.json` untracked (local testing only, delete on merge)
4. Added `user-invocable: true` to skill frontmatter
</decisions>

<blockers>
## Blockers / Gotchas

- **Claude Code bug #20998**: Plugin skills don't appear in autocomplete (reported 2026-01-26, status: OPEN)
  - Skills ARE loaded and work when typed manually
  - Issue: https://github.com/anthropics/claude-code/issues/20998
  - Workaround: Type full command `/dev-workflow:dev-plan` without autocomplete
</blockers>

<notes>
## Notes

- PR serves as meta-demonstration of using dev-workflow to develop dev-workflow itself
- The `.dev/commands-to-skills/` directory in the PR shows real PRD and checkpoint files
</notes>

---

Please continue by checking if bug #20998 has been fixed, then complete Phase 6 merge tasks.
