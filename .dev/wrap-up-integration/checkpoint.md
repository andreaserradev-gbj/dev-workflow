---
branch: feature/wrap-up-integration
last_commit: ec15a48 Restore empty-branch fallback test with branch-aware expectation
uncommitted_changes: false
checkpointed: 2026-02-19T12:00:00Z
---

Read the following PRD files in order:

1. .dev/wrap-up-integration/00-master-plan.md

<context>
## Context

**Goal**: Add a `/dev-wrapup` skill for end-of-session memory review and self-improvement, invoked via prose suggestion from `/dev-checkpoint`
**Current phase**: Phase 1 — Create the session-analyzer agent (not yet started)
**Key completions**: Research complete, architecture decided, PRD written
</context>

<current_state>
## Current Progress

- ✅ Research: Explored skill-to-skill invocation patterns, hooks, superpowers reference, existing codebase
- ✅ Architecture: Decided on standalone skill + dedicated agent + prose suggestion from checkpoint
- ✅ PRD: Written 00-master-plan.md with 3 implementation phases
- ⬜ Phase 1: Create session-analyzer agent — Not Started
- ⬜ Phase 2: Create dev-wrapup SKILL.md — Not Started
- ⬜ Phase 3: Update dev-checkpoint, bump version, update docs, add credits — Not Started
</current_state>

<next_action>
## Next Steps

Phase 1 (session-analyzer agent):
- Create `plugins/dev-workflow/agents/session-analyzer.md`
- Frontmatter: name, color (purple), description, tools (Read only)
- Two output modes: Memory Candidates table and Self-Improvement table
- Guidelines for scanning session conversation
- Privacy rules block
- Follow pattern from `plugins/dev-workflow/agents/checkpoint-analyzer.md`

Phase 2 (dev-wrapup skill):
- Create `plugins/dev-workflow/skills/dev-wrapup/SKILL.md`
- Two phases with STOP gates for user confirmation at each
- Phase 1 "Remember It": memory candidates with destination confirmation
- Phase 2 "Review & Apply": self-improvement signals with action confirmation
- No auto-apply — user confirms every item
</next_action>

<key_files>
## Key Files

- PRD: .dev/wrap-up-integration/00-master-plan.md
- Agent pattern: plugins/dev-workflow/agents/checkpoint-analyzer.md
- Skill pattern: plugins/dev-workflow/skills/dev-checkpoint/SKILL.md
- Suggestion pattern: plugins/dev-workflow/skills/dev-plan/SKILL.md (Phase 3 Step 5)
- New agent: plugins/dev-workflow/agents/session-analyzer.md (to create)
- New skill: plugins/dev-workflow/skills/dev-wrapup/SKILL.md (to create)
</key_files>

<decisions>## Decisions
- Only phases 2 and 3 from original post (Remember It, Review & Apply) — Ship It already in checkpoint, Publish It out of scope
- One agent invoked twice (not two separate agents) — same source material
- Prose suggestion from checkpoint (not hooks or REQUIRED SUB-SKILL) — simplest, most testable
- User confirms every item — no auto-apply, follows dev-workflow philosophy
- Auto-memory items surfaced as suggested commands (tool not available inside skills)
- Credit OP in README Acknowledgments section with link to Reddit post</decisions>

<notes>## Notes
- OP gave explicit permission to integrate the idea ("please do!")
- Reddit post URL: https://www.reddit.com/r/ClaudeCode/comments/1r89084/selfimprovement_loop_my_favorite_claude_code_skill
- Future consideration: agents may move into skill-specific folders
- Superpowers codebase at ~/code/superpowers has useful reference patterns (REQUIRED SUB-SKILL, Integration sections)</notes>

---

Please continue with Phase 1 implementation — create the session-analyzer agent following the specifications in the PRD.
