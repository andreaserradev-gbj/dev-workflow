# Sub-PRD: Stakeholder Markdown

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Complete
**Dependency**: 01-sub-prd-parser
**Last Updated**: 2026-03-02

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Define information hierarchy for stakeholders | ✅ Done |
| **2** | Design the markdown format | ✅ Done |
| **3** | Implement generation in SKILL.md | ✅ Done |
| **4** | Test across platforms | ✅ Done |

---

## Goal

Generate `.dev/board-stakeholder.md` — a clean, platform-neutral markdown summary of project progress suitable for sharing with PMs, stakeholders, and teammates. The content must render correctly when pasted into GitHub (issues, wikis, PRs), Confluence, Jira, Notion, Slack, or email.

This is about editorial decisions as much as technical ones: what to include, what to omit, and how to frame progress for a non-developer audience.

---

## Implementation Steps

### Step 1: Define Information Hierarchy

**What stakeholders care about:**
- Overall project health (are we on track?)
- What's done, what's in progress, what's blocked
- Timeline and key dates (if available)
- Key decisions made (and their rationale)
- Next milestones

**What to omit:**
- Phase gate markers (`⏸️ **GATE**`)
- Verification checklists (`- [ ]` / `- [x]`)
- File change summaries (new/modified files)
- Internal reference paths
- Research findings and codebase patterns
- Agent-specific details

**What to translate:**
- `⬜`/`✅` step markers → "X of Y complete" counts
- Phase status → human-readable labels ("Done", "In Progress", "Not Started")
- Feature status (Active/Complete/Stale) → project-appropriate language

### Step 2: Design the Markdown Format

The output must be:
- Pure GitHub-flavored markdown (no HTML tags, no raw emoji in status — use text labels)
- Structured with clear headers for scanning
- Concise — stakeholders won't read a long document

Proposed structure:

```markdown
# [Project Name] - Status Update

**Date**: [YYYY-MM-DD]
**Features**: [N] total | [X] active | [Y] complete | [Z] stale

---

## Active Features

### [Feature Name]

[First sentence of executive summary]

**Progress**: [X/Y] phases complete ([A/B] steps done)
**Last Activity**: [date]
**Next**: [next action — one line]

| Phase | Status | Progress |
|-------|--------|----------|
| 1. [Title] | Done | 5/5 |
| 2. [Title] | In Progress | 3/7 |
| 3. [Title] | Not Started | 0/4 |

---

## Completed Features

| Feature | Completed |
|---------|-----------|
| [name] | [date] |

---

## Stale Features

| Feature | Last Activity | Progress |
|---------|---------------|----------|
| [name] | [date] | 8/15 steps |
```

Adapt based on what data is available:
- If no completed features, omit that section
- If no stale features, omit that section
- If a feature has sub-PRDs, add a nested table under the phase table
- If a feature has no phases (No PRD status), list it separately

### Step 3: Implement Generation in SKILL.md

Update SKILL.md Step 4 (from Sub-PRD 1) to:

1. Take the structured data from the board-generator agent
2. Group features by status: Active first, then Complete, then Stale, then No PRD
3. For each active feature, render the full detail block (summary, progress, phase table)
4. For completed features, render a summary table
5. For stale features, render a summary table with last activity
6. Add header with project name and generation date
7. Write to `$PROJECT_ROOT/.dev/board-stakeholder.md`

### Step 4: Test Across Platforms

Verify the generated markdown renders correctly on:
- **GitHub**: paste into an issue body or wiki page
- **Notion or Linear**: paste into a doc or project update (both support GFM tables)
- **Confluence or Jira**: paste into a page or issue description (both auto-convert GFM tables)
- **Slack**: paste the header + active features section (tables render as code blocks in Slack — verify readability)
- **Plain text**: the markdown should be readable even without rendering (clean structure, no HTML-dependent formatting)

---

## Files Changed

### New Files

None — the markdown generation is added to the existing SKILL.md.

### Modified Files

| File | Changes |
|------|---------|
| `skills/dev-board/SKILL.md` | Replace Step 4 placeholder with markdown generation logic |

---

## Verification Checklist

- [ ] Generated markdown contains no HTML tags
- [ ] Generated markdown contains no raw emoji (uses text labels for status)
- [ ] Tables use standard GFM pipe syntax
- [ ] Active features have full detail (summary, progress, phase table)
- [ ] Completed features have summary table with dates
- [ ] Stale features have summary table with last activity and progress
- [ ] Empty sections (no completed, no stale) are omitted entirely
- [ ] Renders correctly on GitHub (issue or wiki)
- [ ] Renders correctly on Confluence (paste or MCP push)
- [ ] Readable as plain text without markdown rendering

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
