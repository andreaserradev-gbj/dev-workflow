---
branch: feature/agentskills-compliance
last_commit: 3bdd87d Add /dev-wrapup skill for session review and self-improvement (#8)
uncommitted_changes: false
checkpointed: 2026-02-28T12:00:00Z
---

Read the following PRD files in order:

1. .dev/agentskills-compliance/00-master-plan.md
2. .dev/agentskills-compliance/01-sub-prd-distribution.md
3. .dev/agentskills-compliance/02-sub-prd-skill-updates.md
4. .dev/agentskills-compliance/03-sub-prd-test-cleanup.md

<context>
## Context

**Goal**: Refactor dev-workflow plugin skill structure so each skill is self-contained per the AgentSkills.io specification
**Current phase**: Phase 1 — Script & Agent Distribution (not started)
**Key completions**: PRD planning complete with 4 documents covering 3 implementation phases
</context>

<current_state>
## Current Progress

- ✅ Research: Compared AgentSkills.io spec with Claude Code skills docs, identified all compliance gaps
- ✅ Architecture: Decided on script duplication + per-skill agents + plugin.json registration + sync test
- ✅ PRD: Created master plan and 3 sub-PRDs with detailed implementation steps
- ⬜ Phase 1: Copy scripts and agents into skill directories (01-sub-prd-distribution.md)
- ⬜ Phase 2: Update SKILL.md paths, descriptions, and plugin.json (02-sub-prd-skill-updates.md)
- ⬜ Phase 3: Repoint tests, add sync guard, delete shared dirs, bump version (03-sub-prd-test-cleanup.md)
</current_state>

<next_action>
## Next Steps

Phase 1 — Script & Agent Distribution (01-sub-prd-distribution.md):
- Create `scripts/` directories in all 5 skill directories
- Copy `discover.sh` into all 5 skills, `validate.sh` into 4, `git-state.sh` into 2, `worktree-setup.sh` into 1
- Create `agents/` directories in 4 skill directories (not dev-wrapup)
- Copy each agent into its owning skill (1:1 mapping)
- Verify with `bash tests/test-scripts.sh` (shared dirs still intact)
</next_action>

<key_files>
## Key Files

- Master plan: .dev/agentskills-compliance/00-master-plan.md
- Phase 1 PRD: .dev/agentskills-compliance/01-sub-prd-distribution.md
- Phase 2 PRD: .dev/agentskills-compliance/02-sub-prd-skill-updates.md
- Phase 3 PRD: .dev/agentskills-compliance/03-sub-prd-test-cleanup.md
- Shared scripts: plugins/dev-workflow/scripts/ (discover.sh, validate.sh, git-state.sh, worktree-setup.sh)
- Shared agents: plugins/dev-workflow/agents/ (5 agent definitions)
- Plugin config: plugins/dev-workflow/.claude-plugin/plugin.json
- Test harness: tests/test-scripts.sh
</key_files>

<decisions>## Decisions
- Script duplication over symlinks — symlinks don't survive plugin cache copying
- Per-skill agent registration via `plugin.json` `agents` array — Claude Code only auto-discovers from plugin root `agents/`
- `dev-checkpoint/scripts/` as canonical test source — only skill with all 4 scripts
- Checksum sync test on pre-commit to catch drift between script copies
- Description fields will get "when to use it" trigger phrases for spec compliance</decisions>

<notes>## Notes
- AgentSkills.io spec requires file references one level deep from SKILL.md; current `../../scripts/` violates this
- Claude Code-specific frontmatter fields (argument-hint, disable-model-invocation) are acceptable platform extensions
- Each agent maps 1:1 to a single skill — no agent sharing across skills
- Scripts are self-contained with no inter-script dependencies</notes>

---

Please continue with Phase 1 (Script & Agent Distribution), following the specifications in 01-sub-prd-distribution.md. Copy scripts and agents into their owning skill directories without deleting shared directories or changing SKILL.md references.
