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
