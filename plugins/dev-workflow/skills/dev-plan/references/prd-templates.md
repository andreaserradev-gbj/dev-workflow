# PRD Templates

## Template: Master Plan (`00-master-plan.md`)

```markdown
# [Feature Name] - Master Plan

**Status**: Not Started
**Created**: [Date]
**Last Updated**: [Date]

---

## Executive Summary

[1-2 paragraphs: what the feature does and why it's needed]

**Reference**: [Path to existing implementation if any]

---

## Research Findings

### Codebase Patterns
- [Pattern]: [Where found] — [How it applies]

### Dependencies
- [Dependency]: [Purpose]

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| [Choice] | [Why]     | [What else was considered] |

### Constraints

- **Reuse**: [Existing utilities/helpers to use instead of rebuilding]
- **Patterns to follow**: [Conventions from reference implementations]
- **Avoid**: [Known anti-patterns or approaches that won't work]

---

## Architecture Decision

**Approach**: [The main architectural choice]

[Explanation of why this approach was chosen]

**Data Flow**:
[ASCII diagram if helpful]

---

## Sub-PRD Overview

_(Only for complex features. Remove this section for simple features.)_

| Sub-PRD | Title | Dependency | Status | Document |
|---------|-------|------------|--------|----------|
| **1** | [Title] | None | Not Started | [link] |
| **2** | [Title] | 1 | Not Started | [link] |

---

## Implementation Order

### Phase 1: [Phase Name]
**Goal**: [What this phase accomplishes]

1. ⬜ [Step 1]
2. ⬜ [Step 2]
3. ⬜ [Step 3]

**Verification**:
- [ ] [What should work after this phase]
- [ ] Run: `[specific command, e.g. npm test, npm run build]`

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

_(Repeat for additional phases. Each needs: Goal, numbered ⬜ steps, Verification checklist, and ⏸️ GATE.)_

_Status markers: `⬜` pending; `✅` `⏭️` `⛔` `⏹️` resolved (done, skipped, dropped, deferred — all count toward `done`). Start every step at `⬜`. Any other emoji in the marker slot parses as an unrecognized status: the step still counts toward the total but reads as not done, and `status-update` refuses to overwrite it._

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `path/to/file` | [Description] |

### Modified Files

| File | Changes |
|------|---------|
| `path/to/file` | [What changes] |

---

## Reference Files

- [Path]: [Description]
- [Path]: [Description]
```

---

## Template: Sub-PRD (`01-sub-prd-[name].md`)

> **Single source of step tracking.** A phase's numbered steps live in exactly
> one file. If the master plan's Implementation Order enumerates a phase's steps,
> the matching sub-PRD is narrative only — drop its `## Implementation Progress`
> table (or leave it status-free prose). Use the sub-PRD table as the tracked
> checklist ONLY when the master plan collapses those phases into step-less range
> headers (e.g. `### Phases 1–2: …`). Duplicating steps in both places leaves the
> sub-PRD counters stale — `status-update` writes one file, and the dashboard
> then shows a misleading `0/N` for the sub-PRD.

```markdown
# Sub-PRD: [Title]

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Not Started
**Dependency**: [Previous sub-PRD if any]
**Last Updated**: [Date]

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | [Description] | ⬜ Not Started |
| **2** | [Description] | ⬜ Not Started |

_Keep these three leading columns in this order — the parser reads the step ID from the first and the status from the third. The marker must **lead** the status cell (`⬜ Not Started`, not `Not Started ⬜`); a trailing glyph reads as an unrecognized status._

---

## Goal

[What this sub-PRD accomplishes]

---

## Implementation Steps

### Step 1: [Title]

**File**: `path/to/file`

[Explanation of what to do]

```
[Pseudocode or interface signature]
```

### Step 2: [Title]
...

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `path/to/file` | [Description] |

### Modified Files

| File | Changes |
|------|---------|
| `path/to/file` | [What changes] |

---

## Verification Checklist

- [ ] [Verification step 1]
- [ ] [Verification step 2]

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
```
