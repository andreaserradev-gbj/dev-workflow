---
branch: feature/dev-status
last_commit: 7be09fe Streamline docs and remove manual install option
uncommitted_changes: true
checkpointed: 2026-02-04T12:00:00Z
---

Read the following PRD files in order:

1. `.dev/dev-status/00-master-plan.md`

<context>
## Context

**Goal**: Create a `/dev-status` command that scans all features in `.dev/`, generates a status report, and offers to archive completed/stale features to `.dev-archive/`
**Current phase**: Phase 1 — Create Feature Batch Scanner Agent
**Key completions**: Research complete, architecture approved, PRD created, branch created
</context>

<current_state>
## Current Progress

- ✅ Research phase: 3 prd-researcher agents analyzed codebase patterns
- ✅ User clarifications: Archive = move folders, max 5 agents with batching, save MD report
- ✅ Architecture design: prd-planner designed batched parallel scanning approach
- ✅ Architecture approval: User approved max 5 agents strategy
- ✅ PRD creation: Master plan created at `.dev/dev-status/00-master-plan.md`
- ✅ Branch creation: Created `feature/dev-status` branch
- ⬜ Phase 1: Create feature-batch-scanner agent — Not Started
- ⬜ Phase 2: Create dev-status command — Not Started
- ⬜ Phase 3: Testing — Not Started
</current_state>

<next_action>
## Next Steps

Phase 1 Implementation (agent):
- Create `plugins/dev-workflow/agents/feature-batch-scanner.md` with YAML frontmatter
- Define Mission section for scanning multiple feature folders
- Define Output Format with structured status per feature
- Add Guidelines for parsing PRD files and status markers
- Add Privacy Rules section

Phase 2 Implementation (command):
- Create `plugins/dev-workflow/commands/dev-status.md` with YAML frontmatter
- Implement feature discovery, batch calculation, parallel agent invocation
- Implement result aggregation, report presentation, archive offer, report saving
</next_action>

<key_files>
## Key Files

- Master PRD: `.dev/dev-status/00-master-plan.md`
- New agent (to create): `plugins/dev-workflow/agents/feature-batch-scanner.md`
- New command (to create): `plugins/dev-workflow/commands/dev-status.md`
- Reference agent: `plugins/dev-workflow/agents/checkpoint-analyzer.md`
- Reference command: `plugins/dev-workflow/commands/dev-checkpoint.md`
</key_files>

<decisions>
## Decisions

- Max 5 agents with batching: Balances parallelism vs cost; avoids rate limits
- Archive = move folders to `.dev-archive/`: Keeps `.dev/` clean; grep/find won't scan archived
- Save report as `.dev/status-report-YYYY-MM-DD.md`: Persistent record, human-readable
- Stale threshold = 30 days since last checkpoint: Reasonable inactivity threshold
</decisions>

---

Please continue with Phase 1 implementation: create the `feature-batch-scanner` agent following the specifications in the PRD.
