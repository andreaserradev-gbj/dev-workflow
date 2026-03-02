# Sub-PRD: HTML Board

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Complete
**Dependency**: 01-sub-prd-parser
**Last Updated**: 2026-03-02

---

## Implementation Progress

| Step | Description | Status |
|------|-------------|--------|
| **1** | Design the board layout and information hierarchy | ✅ Done |
| **2** | Build board-template.html | ✅ Done |
| **3** | Implement JSON injection in SKILL.md | ✅ Done |
| **4** | Test with real project data | ✅ Done |

---

## Goal

Create a self-contained HTML dashboard that renders all `.dev/` features as a visual board. The file is generated at `.dev/board.html` and opened in a browser. It should be clean, simple, and nice to view.

This is a developer tool — optimized for quick understanding of project state, not for sharing.

---

## Implementation Steps

### Step 1: Design the Board Layout

Define the information hierarchy before writing code.

**What the developer needs to see at a glance:**
- How many features, how many active/complete/stale
- Which feature needs attention next
- Per-feature: overall progress, current phase, what's next
- Per-phase (expandable): step breakdown, what's done, what's pending

**Layout direction:**
- Summary header: feature counts, overall health
- Feature cards: one per feature, vertically stacked or in a grid
- Each card: feature name, status badge, progress bar, phase list (collapsible), last activity, next action
- Phase details: step counts, expandable to show individual steps

**Design constraints:**
- Dark theme (dark background, light text, colored accents for status)
- System font stack (no web fonts, no CDN)
- Responsive (readable at any width)
- Self-contained (inline CSS + JS, no external deps)
- Generated timestamp in footer

Produce a mockup or wireframe description before building.

### Step 2: Build board-template.html

**File**: `skills/dev-board/references/board-template.html`

A complete HTML file with:

**CSS (inline `<style>`):**
- CSS custom properties for theming (colors, spacing, radii)
- Dark background (#1a1a2e or similar), card surfaces slightly lighter
- Status colors: green (complete), blue (active), amber (stale), gray (no PRD)
- Progress bars with color fill
- Clean typography: system sans-serif, appropriate sizing hierarchy
- Card layout with subtle borders or shadows
- Responsive grid or flex layout

**HTML structure:**
- Header with project name and generation timestamp
- Summary bar: total features, active/complete/stale counts as colored badges
- Feature cards section
- Each card: name, status badge, progress bar (steps done/total), phase breakdown, last activity, next action
- Phase list inside each card: collapsible `<details>` elements showing steps per phase
- Footer with generation date

**JS (inline `<script>`):**
- Reads from `const BOARD_DATA = {...}` (injected by the skill)
- `renderBoard()` function builds all DOM from the data object
- `renderFeatureCard(feature)` for each feature
- `renderPhaseList(phases)` for expandable phase details
- Progress bar calculation from step counts
- Status badge styling based on feature status
- No external fetches, no timers, no auto-refresh (static snapshot)

**Data contract** (JSON shape the template expects):
```json
{
  "projectName": "my-project",
  "generatedAt": "2026-03-02T10:00:00Z",
  "summary": {
    "total": 5,
    "active": 2,
    "complete": 2,
    "stale": 1,
    "noPrd": 0
  },
  "features": [
    {
      "name": "feature-name",
      "status": "active",
      "created": "2026-01-15",
      "lastUpdated": "2026-02-28",
      "lastCheckpoint": "2026-02-28",
      "summary": "First sentence of executive summary.",
      "progress": {
        "phasesComplete": 2,
        "phasesTotal": 4,
        "stepsComplete": 12,
        "stepsTotal": 20
      },
      "nextAction": "Implement the authentication middleware",
      "phases": [
        {
          "number": 1,
          "title": "Setup",
          "stepsDone": 5,
          "stepsTotal": 5,
          "status": "complete"
        }
      ],
      "subPrds": [
        {
          "id": "01",
          "title": "Parser",
          "stepsDone": 3,
          "stepsTotal": 5,
          "status": "in-progress",
          "steps": [
            { "number": 1, "description": "Step description text", "status": "done" },
            { "number": 2, "description": "Step description text", "status": "pending" }
          ]
        }
      ]
    }
  ]
}
```

### Step 3: Implement JSON Injection in SKILL.md

Update SKILL.md Step 3 (from Sub-PRD 1) to:

1. Read `references/board-template.html`
2. Construct the JSON object from the board-generator agent's structured output
3. Replace `<!-- BOARD_DATA -->` in the template with `<script>const BOARD_DATA = {json};</script>`
4. Derive project name from git repo name (`basename $(git rev-parse --show-toplevel)`) or folder name
5. Add generation timestamp (ISO 8601)
6. Write the result to `$PROJECT_ROOT/.dev/board.html`

### Step 4: Test with Real Project Data

- Generate board for a project with multiple features in different states
- Verify all features render with correct progress
- Verify phase expansion works
- Verify the HTML works offline (no network requests)
- Check browser rendering: Chrome, Safari, Firefox
- Check that the file size is reasonable (should be well under 100KB)

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `skills/dev-board/references/board-template.html` | Self-contained HTML template with dark theme |

### Modified Files

| File | Changes |
|------|---------|
| `skills/dev-board/SKILL.md` | Replace Step 3 placeholder with HTML generation logic |

---

## Verification Checklist

- [ ] `board-template.html` is valid HTML5, self-contained, no external deps
- [ ] Template renders correctly with sample data before integration
- [ ] `.dev/board.html` generated with correct data from real PRDs
- [ ] Feature cards show accurate progress bars and phase breakdowns
- [ ] Status badges display correct colors
- [ ] Phase details are expandable/collapsible
- [ ] Dark theme is clean and readable
- [ ] File works offline (no network requests in DevTools)
- [ ] File size under 100KB

⏸️ **GATE**: Sub-PRD complete. Continue to next sub-PRD or `/dev-checkpoint`.
