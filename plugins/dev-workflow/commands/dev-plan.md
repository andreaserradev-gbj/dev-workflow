---
description: Plan a new feature with structured PRD documentation
argument-hint: <feature description>
---

## Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this command.

## PRIMARY DIRECTIVE

Your sole deliverable is PRD files written to `$PROJECT_ROOT/.dev/<feature-name>/`.
This command is part of a 3-command system that creates persistent memory across Claude sessions:
- **`/dev-plan`** (this command) — produces the PRD documentation
- **`/dev-checkpoint`** — saves progress and generates a continuation prompt
- **`/dev-resume`** — loads a checkpoint and resumes work

You produce documentation, not code. Every session must end with files on disk.

**Note**: All `.dev/` references in this command refer to `$PROJECT_ROOT/.dev/`, where `$PROJECT_ROOT` is determined in Step 0.

## PLAN MODE NOTE

If plan mode is active: write a PRD summary to the plan file, call `ExitPlanMode`, then write the full PRD files after approval. You are still producing documentation, not code.

## 3-COMMAND ECOSYSTEM

`/dev-checkpoint` reads your PRD files and creates `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md` with a continuation prompt. It relies on:
- **Status markers** (`⬜`/`✅`) in implementation steps to track progress
- **Phase gates** with "Continue or `/dev-checkpoint`" to mark safe pause points
- **File Changes Summary** to know which files will be modified
- **Sub-PRD links** in the master plan to navigate the full plan

`/dev-resume` reads the checkpoint and PRD files to resume work. It expects `$PROJECT_ROOT/.dev/<feature-name>/` to contain at minimum `00-master-plan.md`.

## EXPLORE AGENT

Use the **Task tool** with `subagent_type=Explore` for codebase research. It can find files by pattern, search for keywords, and answer structural questions. Launch multiple searches in parallel when possible.

## PHASE 1: UNDERSTAND

$ARGUMENTS

The 3 key questions for this phase:
1. **What feature do you want to build?** (Brief description)
2. **What problem does it solve?** (User need or business requirement)
3. **Is there a reference implementation?** (Existing code, similar feature)

### Path A — Arguments were provided above

If `$ARGUMENTS` above is non-empty (the user provided a feature description):
1. Extrapolate answers to all 3 questions from the provided text.
2. Present a 2-3 sentence summary of your understanding.
3. **Proceed directly to Phase 2.** Do not ask for confirmation.

### Path B — No arguments provided

If `$ARGUMENTS` above is empty (the user ran `/dev-plan` with no arguments):
1. Ask the 3 questions above.
2. **STOP. Do not output anything else. Do not proceed until the user responds with their answers.**
3. After receiving answers, summarize your understanding in 2-3 sentences.
4. Ask: "Does this capture your intent? Confirm and I'll start researching."
5. Do NOT move to Phase 2 until the user explicitly confirms.

> **Guardrail**: Once confirmed (Path B) or summarized (Path A), move to research. Don't linger here.

## PHASE 2: RESEARCH

Based on my answers, investigate the codebase using the Explore agent. Focus on:
- Existing patterns that can be reused
- Files that will need modification
- Architecture constraints and dependencies
- Similar implementations to learn from

### Research Summary Format

After investigation, present:
1. **Patterns to reuse** — existing code/architecture you'll leverage
2. **Files to modify** — list of paths with 1-line descriptions
3. **Key decisions** — 2-3 architectural choices needing confirmation
4. **Open questions** — anything unclear (if any)

Keep it to ~10-15 lines. Ask for corrections or additions before proceeding.

> **Guardrail**: Research serves the PRD. Move to writing after one research round. If I request deeper investigation, do one more round — then write.

## PHASE 3: WRITE THE PRD

1. **Determine complexity**: Simple (1-3 files, single phase) = single PRD file. Complex (4+ files, multiple phases) = master plan + sub-PRDs.
2. **Propose architecture approach** based on research. Ask me to confirm or adjust.
3. **Create files** under `$PROJECT_ROOT/.dev/<feature-name>/`:
   - Always create `00-master-plan.md` (use Master Plan Template below)
   - For complex features, create `01-sub-prd-[name].md` etc. (use Sub-PRD Template below)
4. **State what was created** — list every file path written.
5. **Suggest running `/dev-checkpoint`** to save a continuation prompt.

> **Guardrail**: You MUST create files. If you reach this phase without writing, stop everything else and write the PRD.

## RULES

- ALWAYS produce at least `$PROJECT_ROOT/.dev/<feature-name>/00-master-plan.md`
- Do NOT research endlessly — one round of research, then write
- Fold research findings into the master plan's "Research Findings" section (no separate `findings.md`)
- Use status markers (`⬜`/`✅`) and phase gates so `/dev-checkpoint` can parse progress
- End by telling me what files were created and suggesting `/dev-checkpoint`

---

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

**Verification**: [How to verify this phase is complete]

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 2: [Phase Name]
**Goal**: [What this phase accomplishes]

1. ⬜ [Step 1]
2. ⬜ [Step 2]

**Verification**: [How to verify this phase is complete]

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

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

---

<details>
<summary><strong>CHECKPOINT COMPATIBILITY</strong> (reference for maintainers)</summary>

Your PRD files must be parseable by `/dev-checkpoint` and `/dev-resume`. The contract:

| Element | Format | Used By |
|---------|--------|---------|
| Status markers | `⬜` (pending) / `✅` (done) | `/dev-checkpoint` updates these |
| Phase gates | `⏸️ **GATE**: ... Continue or /dev-checkpoint.` | `/dev-checkpoint` identifies pause points |
| File paths | Backtick-quoted in File Changes Summary | `/dev-resume` reads for context |
| Sub-PRD links | Relative links in Sub-PRD Overview table | `/dev-resume` navigates the full plan |
| Feature directory | `$PROJECT_ROOT/.dev/<feature-name>/` | Both commands locate files here |
| YAML frontmatter | `branch`, `last_commit`, `uncommitted_changes`, `checkpointed` in checkpoint | `/dev-resume` verifies context (branch, staleness, drift) |
| Semantic XML tags | `<context>`, `<current_state>`, `<next_action>`, `<key_files>`, `<decisions>`, `<blockers>`, `<notes>` | `/dev-resume` scans sections; `/dev-checkpoint` wraps content |
| Decisions/Blockers | `<decisions>` and `<blockers>` sections (omitted if empty) | `/dev-checkpoint` captures; `/dev-resume` surfaces in summary |

</details>
