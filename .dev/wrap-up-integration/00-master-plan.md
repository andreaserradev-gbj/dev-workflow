# Wrap-Up Integration - Master Plan

**Status**: Complete
**Created**: 2026-02-19
**Last Updated**: 2026-02-19

---

## Executive Summary

Add a `/dev-wrapup` skill that reviews the current session for learnings worth persisting and self-improvement signals. Inspired by a community "self-improvement loop" concept, adapted to the dev-workflow philosophy where the user is always in control — nothing is applied without explicit confirmation.

The skill scans the conversation in a single pass for both memory candidates and self-improvement signals, presents a combined findings table, and applies user-confirmed items. It runs as a standalone skill, suggested by `/dev-checkpoint` at the end of its flow. Analysis is performed inline by the orchestrator (not a subagent) because subagents cannot access parent conversation history.

**Inspiration**: Reddit post by community member describing a 4-phase wrap-up skill. We adapt phases 2 and 3 (Remember It, Review & Apply), skip Ship It (already handled by checkpoint) and Publish It (out of scope).

---

## Research Findings

### Codebase Patterns

- **Skill structure**: All skills follow the same shape — YAML frontmatter (`name`, `description`, `allowed-tools`), numbered steps, STOP gates for confirmation, privacy rules block
- **Agent pattern**: Agents live in `plugins/dev-workflow/agents/`, have YAML frontmatter (`name`, `color`, `description`, `tools`), structured output format, and privacy rules
- **Script-first discovery**: Every skill starts with `bash "$DISCOVER" root` (Step 0)
- **Prose suggestion for skill chaining**: `dev-plan` suggests `/dev-checkpoint` at the end of Phase 3 — established pattern for cross-skill flow
- **Confirmation gates**: `dev-checkpoint` uses explicit STOP + question blocks before applying changes (Steps 6, 9.5, 10)

### Dependencies

- `discover.sh` — project root detection (reuse existing)
- `checkpoint-analyzer.md` — existing agent, different purpose (PRD progress), cannot reuse
- `Write` tool — needed to apply confirmed changes to CLAUDE.md, rules, CLAUDE.local.md

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Inline analysis (no subagent) | Subagents launched via Task tool cannot access parent conversation history — the orchestrator must do the analysis itself since it has the full context | Session-analyzer subagent (rejected: no context access) |
| Single analysis pass | Memory candidates and self-improvement signals draw on same source material; one pass is simpler and avoids redundant scanning | Two separate phases with gate between them (rejected: unnecessary complexity) |
| Prose suggestion from checkpoint | Simplest, most testable approach; follows existing pattern | Hooks (fragile — no SkillCompleted event), REQUIRED SUB-SKILL directive (harder to test incrementally) |
| User confirms every item | Core dev-workflow philosophy: user is always in control | Auto-apply (rejected: user didn't want it) |
| Auto memory via prompt-based delegation | Instruct Claude to "save to your auto memory" — each CLI implementation (Claude Code, Codex, future tools) decides how to store. Portable across implementations. | Direct file writes to memory dir (fragile — path/format may change) |

### Constraints

- **Reuse**: `discover.sh` for project root, existing frontmatter patterns from other skills/agents
- **Patterns to follow**: Numbered steps, STOP gates, agent invocation with `subagent_type=dev-workflow:<name>`, privacy rules block
- **Avoid**: Auto-applying without confirmation, `@import` force-loading of other skills, shell variables between Bash calls

---

## Architecture Decision

**Approach**: Standalone skill with inline analysis, connected by prose suggestion

```
/dev-checkpoint (existing)
  └── Step 9 summary now ends with: "Suggest running /dev-wrapup"

/dev-wrapup (new)
  ├── Read existing memory (CLAUDE.md, rules, CLAUDE.local.md)
  ├── Scan conversation for findings (single pass, done by orchestrator)
  ├── Present combined findings table → STOP for confirmation
  └── Apply confirmed items (Write to CLAUDE.md, rules, auto memory, etc.)
```

**Key insight**: Subagents launched via Task tool start with a fresh context and cannot access the parent conversation history. Since session analysis requires the full conversation, the orchestrator must perform it directly.

**Future consideration**: Agents may move into skill-specific folders (e.g., `skills/dev-wrapup/agents/`). For now, follows the existing convention of `plugins/dev-workflow/agents/`.

---

## Implementation Order

### Phase 1: Create the session-analyzer agent
**Goal**: Establish the read-only analysis agent that reviews conversation history.

1. ✅ Create `plugins/dev-workflow/agents/session-analyzer.md` with:
   - Frontmatter: `name: session-analyzer`, `color: purple`, `description`, `tools: Read`
   - Mission: read-only analysis of session conversation
   - Two output modes (selected by prompt):
     - **Memory Candidates table**: Finding | Category | Proposed Destination | Rationale
     - **Self-Improvement table**: Signal Type | Observation | Proposed Action
   - Guidelines for what to scan (corrections, stated facts, friction moments, project quirks)
   - Privacy rules block

**Verification**:
- [x] File exists at correct path with valid YAML frontmatter
- [x] Output format matches what SKILL.md will expect
- [x] Tools list is minimal (`Read` only)

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: Create the dev-wrapup skill
**Goal**: Write the full SKILL.md with two phases and confirmation gates.

1. ✅ Create directory `plugins/dev-workflow/skills/dev-wrapup/`
2. ✅ Create `plugins/dev-workflow/skills/dev-wrapup/SKILL.md` with:
   - Frontmatter: `name: dev-wrapup`, `description`, `allowed-tools: Bash(bash:*) Read Write`
   - REVIEW-ONLY MODE guard (parallel to checkpoint's SAVE-ONLY MODE)
   - Step 0: Discover Project Root (standard pattern)
   - Phase 1 — Remember It: agent launch → findings table → STOP gate → apply confirmed
   - Phase 2 — Review & Apply: agent launch → findings table → STOP gate → apply confirmed
   - Summary step
   - Privacy rules block

**Verification**:
- [x] SKILL.md exists with valid frontmatter
- [x] Both phases have STOP gates before applying changes
- [x] Agent invocations use `subagent_type=dev-workflow:session-analyzer`
- [x] No auto-apply — every write requires user confirmation

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 3: Update dev-checkpoint and bump version
**Goal**: Connect the skills and prepare for release.

1. ✅ Add prose suggestion to `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` at end of Step 10 (after optional commit, as final line of the skill)
2. ✅ Bump version in `.claude-plugin/marketplace.json` from `1.7.0` to `1.8.0`
3. ✅ Update `CLAUDE.md` repository structure to include new files
4. ✅ Add "Acknowledgments" section to `README.md` crediting the [original Reddit post](https://www.reddit.com/r/ClaudeCode/comments/1r89084/selfimprovement_loop_my_favorite_claude_code_skill) that inspired `/dev-wrapup`
5. ✅ Run tests: `bash tests/test-scripts.sh`

**Verification**:
- [x] dev-checkpoint ends with wrap-up suggestion
- [x] Version bumped in marketplace.json
- [x] CLAUDE.md structure reflects new files
- [x] README.md has Acknowledgments section with link to original post
- [x] All tests pass

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `plugins/dev-workflow/agents/session-analyzer.md` | ~~Removed~~ — subagents cannot access parent conversation; analysis moved inline to SKILL.md |
| `plugins/dev-workflow/skills/dev-wrapup/SKILL.md` | Two-phase session wrap-up skill with user-confirmed application |

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` | Add prose suggestion for `/dev-wrapup` after Step 10 |
| `.claude-plugin/marketplace.json` | Bump version `1.7.0` → `1.8.0` |
| `CLAUDE.md` | Add new files to repository structure |
| `README.md` | Add Acknowledgments section crediting original Reddit post |

---

## Reference Files

- `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` — primary skill this pairs with
- `plugins/dev-workflow/agents/checkpoint-analyzer.md` — agent pattern to follow
- `plugins/dev-workflow/skills/dev-plan/SKILL.md` — prose suggestion pattern (Phase 3 Step 5)
- Reddit post "Self-Improvement Loop" — original inspiration (phases 2 and 3)
