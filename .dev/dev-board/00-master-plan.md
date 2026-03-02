# dev-board - Master Plan

**Status**: Planning Complete
**Created**: 2026-03-02
**Last Updated**: 2026-03-02

---

## Executive Summary

A new dev-workflow skill (`/dev-board`) that generates a visual project dashboard and a stakeholder summary from existing PRD files. The `.dev/` folder is already the source of truth for feature progress — dev-board reads it and produces two outputs: a self-contained HTML board for the developer and a platform-neutral markdown file for sharing with stakeholders.

The skill fits into the existing dev-workflow system alongside `/dev-plan`, `/dev-checkpoint`, `/dev-resume`, `/dev-status`, and `/dev-wrapup`. It adds no new state or databases — PRD files remain the single source of truth.

---

## Research Findings

### Codebase Patterns

- Skill structure (SKILL.md + agents/ + scripts/ + references/): all existing skills follow this layout — `dev-status/SKILL.md` is the closest analog
- Discovery scripts (`discover.sh root`, `discover.sh features`): reusable across skills, handle project root detection and `.dev/` enumeration
- Agent frontmatter convention: `name`, `color`, `description`, `tools` fields — read-only agents use `Read, Glob, Grep, LS`
- Plugin registration: agents must be added to `plugin.json` in both `marketplaces/` and `cache/` directories
- PRD canonical format: `### Phase N: Title` headers, `1. ⬜/✅ [step]` numbered lists, `- [ ]/[x]` verification, `⏸️ **GATE**:` markers
- Sub-PRD format: `### Step N:` headings, Implementation Progress table with `⬜ Not Started`/`✅ Done` cells
- Checkpoint format: YAML frontmatter with `checkpointed:` ISO 8601 date
- Privacy rules: every skill and agent ends with privacy section (relative paths, no secrets)

### Dependencies

- `bash` + `discover.sh`: project root and feature discovery
- Claude Code Task tool: agent invocation with `subagent_type=dev-workflow:board-generator`
- No external dependencies for generated HTML (self-contained)

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Single agent scans all features | Dashboard is a read-only snapshot; no need for parallel agents unlike dev-status which processes large batches | Parallel agents per feature (unnecessary overhead for a display-only skill) |
| JSON data injected into HTML template | Clean separation of data and presentation; template can be refined independently | Generate HTML directly in the agent (couples parsing with presentation) |
| Stakeholder markdown is a separate output | Different audience, different information hierarchy; platform-neutral by design | Single HTML output with "print view" (limits sharing to browser-capable platforms) |
| Parse canonical dev-workflow format only | The canonical format (`1. ⬜/✅`) is what all dev-workflow PRDs produce; other projects may use different formats (e.g., `- [ ]/[x]/[~]` on phases) | Support multiple formats (unnecessary complexity, non-canonical formats can be normalized upstream) |

### Constraints

- **Reuse**: `discover.sh` for root and feature enumeration; `feature-batch-scanner.md` as agent template; `prd-templates.md` as the canonical format spec
- **Patterns to follow**: SKILL.md structure from dev-status; STOP gates between steps; privacy rules block
- **Avoid**: External dependencies in HTML; database or extra state; coupling to any specific sharing platform (Confluence, GitHub, etc.)

---

## Architecture Decision

**Approach**: Three-layer architecture — parser (engine), HTML renderer (developer dashboard), markdown renderer (team output)

The skill orchestrates three concerns that are developed and tested independently:

```
.dev/ PRD files (source of truth)
       │
       ▼
  board-generator agent (parser)
       │
       ▼
  Structured data (per-feature progress)
       │
       ├──▶ board-template.html + JSON injection ──▶ .dev/board.html
       │
       └──▶ Markdown generation ──▶ .dev/board-stakeholder.md
```

Each sub-PRD owns one layer. The parser (Sub-PRD 1) must be correct before the renderers (Sub-PRDs 2 and 3) can produce meaningful output.

---

## Sub-PRD Overview

| Sub-PRD | Title | Dependency | Status | Document |
|---------|-------|------------|--------|----------|
| **1** | Parser and Integration | None | Complete | [01-sub-prd-parser.md](./01-sub-prd-parser.md) |
| **2** | HTML Board | 1 | Complete | [02-sub-prd-html-board.md](./02-sub-prd-html-board.md) |
| **3** | Stakeholder Markdown | 1 | Not Started | [03-sub-prd-stakeholder-md.md](./03-sub-prd-stakeholder-md.md) |

---

## Implementation Order

### Phase 1: Parser and Integration
**Goal**: Create the skill skeleton, agent, and discovery integration. The agent can parse all PRDs in `.dev/` and return structured data.

1. ✅ Scaffold skill directory structure and scripts
2. ✅ Create board-generator agent with PRD parsing rules
3. ✅ Write SKILL.md with discovery and agent orchestration steps
4. ✅ Register agent in plugin.json
5. ✅ Test parsing against real PRD files

**Verification**:
- [ ] `discover.sh root` and `discover.sh features` work from the skill
- [ ] Agent returns structured per-feature data with correct phase/step counts
- [ ] SKILL.md follows dev-workflow conventions (frontmatter, STOP gates, privacy rules)

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 2: HTML Board
**Goal**: Create a self-contained HTML template and integrate it with the skill to produce `.dev/board.html`.

1. ✅ Design and build board-template.html (dark theme, feature cards, progress bars, phase breakdowns)
2. ✅ Implement JSON injection in SKILL.md (data placeholder → script block)
3. ✅ Test with real project data — verify visual output

**Verification**:
- [ ] `.dev/board.html` opens in a browser and renders correctly
- [ ] All features visible with accurate progress
- [ ] No external dependencies (works offline)

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

### Phase 3: Stakeholder Markdown
**Goal**: Generate `.dev/board-stakeholder.md` — a clean, platform-neutral summary suitable for any sharing target.

1. ⬜ Define stakeholder markdown format (what to include, what to omit)
2. ⬜ Implement markdown generation in SKILL.md
3. ⬜ Test copy-paste into different platforms (GitHub issue, Confluence, Slack)

**Verification**:
- [ ] `.dev/board-stakeholder.md` is valid markdown with no HTML or emoji
- [ ] Content is appropriate for stakeholders (no internal gates, verification details, or file paths)
- [ ] Renders correctly when pasted into GitHub and Confluence

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `skills/dev-board/SKILL.md` | Main skill: discovery, agent orchestration, output generation |
| `skills/dev-board/agents/board-generator.md` | Agent: parses PRD files, returns structured progress data |
| `skills/dev-board/references/board-template.html` | HTML template: self-contained dashboard with CSS + JS |
| `skills/dev-board/scripts/discover.sh` | Discovery script (copy of shared script from dev-status) |

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/.claude-plugin/plugin.json` | Add board-generator agent to agents array |

---

## Reference Files

- `plugins/dev-workflow/skills/dev-status/SKILL.md`: Closest structural analog (scan + report skill)
- `plugins/dev-workflow/skills/dev-status/agents/feature-batch-scanner.md`: Read-only scanning agent template
- `plugins/dev-workflow/skills/dev-plan/references/prd-templates.md`: Canonical PRD format specification
- `plugins/dev-workflow/skills/dev-plan/scripts/discover.sh`: Shared discovery script to copy
