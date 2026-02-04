# Dev-Status Command - Master Plan

**Status**: Complete
**Created**: 2026-02-04
**Last Updated**: 2026-02-04

---

## Executive Summary

A new `/dev-status` command for the dev-workflow plugin that scans all features in the `.dev/` folder, generates a status report, and offers to archive completed or stale features to `.dev-archive/`.

The command uses a batched parallel agent strategy: up to 5 agents scan folders in parallel, with folders distributed evenly across agents. This balances cost and performance for projects with many features.

---

## Research Findings

### Codebase Patterns
- **Command structure**: YAML frontmatter + Step 0 project root detection (`commands/dev-plan.md:1-14`)
- **Feature discovery**: `find "$PROJECT_ROOT/.dev" -maxdepth 1 -type d` pattern (`commands/dev-checkpoint.md:36-38`)
- **Parallel agent invocation**: Launch N agents with `subagent_type=dev-workflow:<agent-name>` (`commands/dev-plan.md:79-87`)
- **Agent file format**: YAML frontmatter with name, color, description, tools + Mission/Output/Guidelines sections
- **Status markers**: `✅` (complete), `⬜` (pending), `⏭️` (skipped) in PRD files

### Dependencies
- Task tool with `subagent_type` parameter for agent invocation
- Read, Glob, Grep, LS tools for file system operations
- Bash for folder operations (mkdir, mv for archiving)

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Max 5 agents with batching | Balances parallelism vs cost; avoids rate limits | One agent per folder (expensive), single agent (slow) |
| Move to `.dev-archive/` | Keeps `.dev/` clean; grep/find won't scan archived | Metadata flag (still found by tools) |
| Save report as MD file | Persistent record; human-readable | JSON (less readable), no save (no history) |
| Stale = 30 days since checkpoint | Reasonable inactivity threshold | 7 days (too aggressive), 90 days (too lenient) |

---

## Architecture Decision

**Approach**: Batched parallel scanning with fixed agent pool

```
.dev/
├── feature-a/
├── feature-b/
├── ...
└── feature-n/

Command discovers N folders
  │
  ├─► If N ≤ 5: Launch N agents (1 folder each)
  │
  └─► If N > 5: Launch 5 agents (N/5 folders each)
        │
        ├─► Agent 1: [feature-a, feature-f, ...]
        ├─► Agent 2: [feature-b, feature-g, ...]
        ├─► Agent 3: [feature-c, feature-h, ...]
        ├─► Agent 4: [feature-d, feature-i, ...]
        └─► Agent 5: [feature-e, feature-j, ...]

Agents return structured status for each folder
  │
  ▼
Command aggregates results
  │
  ├─► Display summary table
  ├─► Offer archive for completed/stale
  └─► Save report to .dev/status-report-YYYY-MM-DD.md
```

---

## Implementation Order

### Phase 1: Create Feature Batch Scanner Agent
**Goal**: Create the agent that scans a batch of feature folders and extracts status for each.

1. ✅ Create `plugins/dev-workflow/agents/feature-batch-scanner.md` with YAML frontmatter
2. ✅ Define Mission section: scan multiple feature folders from a provided list
3. ✅ Define Output Format with structured status per feature:
   - Feature name
   - Status (Active / Complete / Stale / No PRD)
   - Phase progress (X/Y phases, A/B steps)
   - Last checkpoint date
   - Next action summary (if active)
4. ✅ Add Guidelines for parsing PRD files and status markers
5. ✅ Add Privacy Rules section

**Verification**: File exists and follows agent structure pattern.

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 2: Create Dev-Status Command
**Goal**: Create the command that orchestrates scanning, aggregation, archiving, and report saving.

1. ✅ Create `plugins/dev-workflow/commands/dev-status.md` with YAML frontmatter
2. ✅ Add Step 0: Determine Project Root (git rev-parse pattern)
3. ✅ Add Step 1: Discover Features (find command, exclude `.dev-archive`)
4. ✅ Add Step 2: Calculate Batches (distribute folders across max 5 agents)
5. ✅ Add Step 3: Launch Parallel Agents (one `feature-batch-scanner` per batch)
6. ✅ Add Step 4: Aggregate Results (collect outputs, build summary table)
7. ✅ Add Step 5: Present Report (display table, identify archivable features)
8. ✅ Add Step 6: Archive Offer (ask user, move folders to `.dev-archive/`)
9. ✅ Add Step 7: Save Report (write to `.dev/status-report-YYYY-MM-DD.md`)
10. ✅ Add Privacy Rules section

**Verification**: Command file exists and can be invoked via `/dev-status`.

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 3: Testing
**Goal**: Validate end-to-end functionality.

1. ✅ Test with small folder count (1-5 features)
2. ✅ Test with larger folder count (simulate batching)
3. ✅ Test archive flow (move to `.dev-archive/`)
4. ✅ Verify report file is created with correct content

**Verification**: All test scenarios pass.

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `plugins/dev-workflow/agents/feature-batch-scanner.md` | Agent that scans a batch of feature folders and returns status for each |
| `plugins/dev-workflow/commands/dev-status.md` | Command that orchestrates parallel scanning, aggregation, archiving, and report generation |

### Modified Files

| File | Changes |
|------|---------|
| None | No existing files need modification |

### Generated Files (at runtime)

| File | Purpose |
|------|---------|
| `.dev/status-report-YYYY-MM-DD.md` | Status report saved by the command |

---

## Reference Files

- `plugins/dev-workflow/commands/dev-checkpoint.md`: Feature discovery pattern
- `plugins/dev-workflow/commands/dev-plan.md`: Parallel agent invocation pattern
- `plugins/dev-workflow/agents/checkpoint-analyzer.md`: Agent structure reference

---

## Agent Output Format

Each `feature-batch-scanner` agent returns:

```markdown
## Batch Results

### feature-name-1

**Status**: Active | Complete | Stale | No PRD
**Progress**: 2/3 phases | 8/12 steps
**Last Checkpoint**: 2026-02-01
**Next Action**: Implement the grid view component

---

### feature-name-2

**Status**: Complete
**Progress**: 3/3 phases | 15/15 steps
**Last Checkpoint**: 2026-01-15
**Next Action**: N/A

---
```

---

## Report File Format

```markdown
# Dev Status Report

**Generated**: 2026-02-04T14:30:00Z
**Project**: dev-workflow
**Features Scanned**: 12

## Summary

| Status | Count |
|--------|-------|
| Active | 3 |
| Complete | 7 |
| Stale | 2 |

## Features

| Feature | Status | Progress | Last Activity |
|---------|--------|----------|---------------|
| feature-a | Active | 2/3 phases | 1 day ago |
| feature-b | Complete | 3/3 phases | 5 days ago |
| feature-c | Stale | 1/4 phases | 45 days ago |

## Archive Candidates

### Complete (ready to archive)
- feature-b
- feature-d

### Stale (no activity > 30 days)
- feature-c
```
