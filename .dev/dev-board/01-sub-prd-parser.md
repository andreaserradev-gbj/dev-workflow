# Sub-PRD: Parser and Integration

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Not Started
**Dependency**: None
**Last Updated**: 2026-03-02

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Scaffold skill directory and copy discover.sh | ⬜ Not Started |
| **2** | Create board-generator agent | ⬜ Not Started |
| **3** | Write SKILL.md orchestration | ⬜ Not Started |
| **4** | Register agent in plugin.json | ⬜ Not Started |
| **5** | Test against real PRD data | ⬜ Not Started |

---

## Goal

Create the dev-board skill skeleton and its core engine: a board-generator agent that reads all `.dev/` features and returns structured progress data. This sub-PRD produces the foundation that the HTML board and stakeholder markdown sub-PRDs build on.

The agent's structured output is the contract between parsing and rendering — it must be stable and correct before any UI work begins.

---

## Implementation Steps

### Step 1: Scaffold Skill Directory

Create the directory structure and copy the shared discovery script.

```
plugins/dev-workflow/skills/dev-board/
├── SKILL.md
├── agents/
│   └── board-generator.md
├── references/
│   └── board-template.html        (created in Sub-PRD 2)
└── scripts/
    └── discover.sh                (copy from dev-status)
```

Copy `discover.sh` from `plugins/dev-workflow/skills/dev-status/scripts/discover.sh`. It already supports `root`, `features`, `archived`, and `status-reports` modes — no modifications needed.

### Step 2: Create Board Generator Agent

**File**: `skills/dev-board/agents/board-generator.md`

Agent frontmatter:
- `name: board-generator`
- `color: magenta`
- `tools: Read, Glob, Grep, LS`

The agent receives a list of feature folder paths and must:

1. For each feature, read `00-master-plan.md` and parse:
   - Frontmatter: `**Status**:`, `**Created**:`, `**Last Updated**:`
   - Executive Summary: first paragraph after `## Executive Summary`
   - Phases: `### Phase N: Title` headers
   - Steps per phase: numbered lines with `⬜` (pending), `✅` (complete), `⏭️` (skipped = counted as complete)
   - Verification items: `- [ ]` / `- [x]` (informational, tracked separately from steps)
   - Phase gates: `⏸️ **GATE**` lines (indicates phase boundary)
   - Sub-PRD overview table: rows with sub-PRD status

2. For each sub-PRD file (`NN-sub-prd-*.md`), parse:
   - Implementation Progress table: `⬜ Not Started` / `✅ Done` / `⏭️ Skipped` cells
   - Step count and completion

3. For `checkpoint.md` (if exists), parse:
   - YAML frontmatter `checkpointed:` field for last activity date
   - `<next_action>` section for the next step

4. Return structured output per feature:
   ```
   ## Feature: [name]
   - **Status**: Active | Complete | Stale | No PRD
   - **Created**: [date]
   - **Last Updated**: [date]
   - **Last Checkpoint**: [date or "None"]
   - **Summary**: [first sentence of executive summary]
   - **Progress**: [completed phases]/[total phases] phases, [completed steps]/[total steps] steps
   - **Next Action**: [first ⬜ step description, or from checkpoint]

   ### Phases
   | Phase | Title | Steps Done | Steps Total | Status |
   |-------|-------|------------|-------------|--------|
   | 1     | ...   | 3          | 5           | In Progress |

   ### Sub-PRDs (if any)
   | Sub-PRD | Title | Steps Done | Steps Total | Status |
   |---------|-------|------------|-------------|--------|
   | 01      | ...   | 2          | 4           | In Progress |
   ```

Status definitions (same as dev-status):
- **Complete**: All phases have all steps `✅`
- **Active**: Has PRD with incomplete steps, checkpoint within 30 days (or no checkpoint but recently updated)
- **Stale**: Has PRD with incomplete steps, no checkpoint or checkpoint >30 days old
- **No PRD**: Feature folder exists but no `00-master-plan.md`

### Step 3: Write SKILL.md

**File**: `skills/dev-board/SKILL.md`

YAML frontmatter:
```yaml
name: dev-board
description: >-
  Generate a project dashboard from .dev/ feature data.
  Produces an HTML board and a stakeholder markdown summary.
allowed-tools: Bash(bash:*) Read Write
```

Orchestration steps:

- **Step 0**: Discover project root (`discover.sh root`)
- **Step 1**: Discover features (`discover.sh features "$PROJECT_ROOT"`). If no `.dev/` or no features, inform user and stop.
- **Step 2**: Launch `board-generator` agent with the list of feature paths. Use `subagent_type=dev-workflow:board-generator` and `model=sonnet`.
- **Step 3**: Generate HTML board (detailed in Sub-PRD 2 — placeholder step for now: "HTML generation — see Sub-PRD 2")
- **Step 4**: Generate stakeholder markdown (detailed in Sub-PRD 3 — placeholder step for now: "Markdown generation — see Sub-PRD 3")
- **Step 5**: Report what was generated — file paths and feature summary counts

Include privacy rules section and STOP gate after Step 2 (before generating outputs) so the user can review the parsed data.

### Step 4: Register Agent in plugin.json

**File**: `plugins/dev-workflow/.claude-plugin/plugin.json`

Add `"./skills/dev-board/agents/board-generator.md"` to the `agents` array. Must be done in both:
- `plugins/marketplaces/dev-workflow/plugins/dev-workflow/.claude-plugin/plugin.json`
- `plugins/cache/dev-workflow/dev-workflow/1.9.0/.claude-plugin/plugin.json`

### Step 5: Test Against Real PRD Data

Test the agent by running `/dev-board` against a project with real `.dev/` data:
- The dev-workflow plugin itself has `.dev-archive/` with completed PRDs
- Verify phase/step counts match manual inspection
- Verify checkpoint dates are parsed correctly
- Verify sub-PRD detection works

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `skills/dev-board/SKILL.md` | Main skill definition with orchestration steps |
| `skills/dev-board/agents/board-generator.md` | PRD parsing agent returning structured progress data |
| `skills/dev-board/scripts/discover.sh` | Discovery script (copy from dev-status) |

### Modified Files

| File | Changes |
|------|---------|
| `.claude-plugin/plugin.json` | Add board-generator to agents array |

---

## Verification Checklist

- [ ] Skill directory structure matches convention
- [ ] `discover.sh root` returns valid project root from dev-board's scripts/
- [ ] `discover.sh features` enumerates `.dev/` features correctly
- [ ] Agent parses a complete PRD and returns correct phase/step counts
- [ ] Agent parses sub-PRDs and includes their progress
- [ ] Agent parses checkpoint.md dates correctly
- [ ] Agent handles missing files gracefully (no checkpoint, no sub-PRDs)
- [ ] Agent handles edge cases: empty phases, all-complete features, no-PRD folders
- [ ] plugin.json updated in both marketplace and cache copies
- [ ] SKILL.md follows dev-workflow conventions (frontmatter, gates, privacy rules)

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
