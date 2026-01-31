# Plugin Structure Refactor - Master Plan

**Status**: Not Started
**Created**: 2026-01-31
**Last Updated**: 2026-01-31

---

## Executive Summary

Refactor the dev-workflow repository to match the official Claude Code plugin marketplace structure. Currently, the repo has a flat structure with `commands/` at the root and `marketplace.json` pointing to `source: "./"` without a corresponding `plugin.json`. The official structure nests plugins under a `plugins/` directory, each with their own `.claude-plugin/plugin.json` manifest.

Additionally, add `argument-hint` frontmatter to commands that accept `$ARGUMENTS` to improve the user experience.

**Reference**: `/Users/andreaserra/.claude/plugins/marketplaces/claude-plugins-official/plugins/feature-dev/`

---

## Research Findings

### Codebase Patterns
- Official marketplace: `marketplace.json` at `.claude-plugin/` with `plugins[]` array
- Each plugin entry has `source` pointing to plugin directory (e.g., `./plugins/feature-dev`)
- Plugin directories contain `.claude-plugin/plugin.json` (name, description, author)
- Commands use `argument-hint` in frontmatter for argument placeholders

### Dependencies
- None — this is a structural refactor only

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Nest under `plugins/dev-workflow/` | Matches official structure, allows future multi-plugin expansion | Keep flat structure with `plugin.json` at root |
| Add `argument-hint` to all 3 commands | Improves discoverability of argument feature | Leave as-is |
| Keep README.md at repo root | Standard location for GitHub repos | Move to plugin directory |

---

## Architecture Decision

**Approach**: Restructure to official multi-plugin marketplace format

The official Claude plugins marketplace uses a nested structure where each plugin lives in its own directory under `plugins/`. This allows:
- Clear separation between marketplace metadata and plugin content
- Future expansion to multiple plugins in one marketplace
- Consistent structure with official examples

**Before:**
```
dev-workflow/
├── .claude-plugin/
│   └── marketplace.json    # source: "./"
├── commands/
│   ├── dev-plan.md
│   ├── dev-checkpoint.md
│   └── dev-resume.md
└── README.md
```

**After:**
```
dev-workflow/
├── .claude-plugin/
│   └── marketplace.json    # source: "./plugins/dev-workflow"
├── plugins/
│   └── dev-workflow/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── commands/
│           ├── dev-plan.md
│           ├── dev-checkpoint.md
│           └── dev-resume.md
└── README.md
```

---

## Implementation Order

### Phase 1: Create New Structure
**Goal**: Set up the new directory structure and plugin manifest

1. ⬜ Create `plugins/dev-workflow/.claude-plugin/` directory
2. ⬜ Create `plugins/dev-workflow/.claude-plugin/plugin.json` with plugin metadata (version 1.2.0)
3. ⬜ Create `plugins/dev-workflow/commands/` directory

**Verification**: Directory structure exists with plugin.json

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 2: Move Commands
**Goal**: Relocate command files to new location and add argument-hint

1. ⬜ Move `commands/dev-plan.md` → `plugins/dev-workflow/commands/dev-plan.md`
2. ⬜ Move `commands/dev-checkpoint.md` → `plugins/dev-workflow/commands/dev-checkpoint.md`
3. ⬜ Move `commands/dev-resume.md` → `plugins/dev-workflow/commands/dev-resume.md`
4. ⬜ Add `argument-hint: Feature description` to dev-plan.md frontmatter
5. ⬜ Add `argument-hint: Feature name` to dev-checkpoint.md frontmatter
6. ⬜ Add `argument-hint: Feature name` to dev-resume.md frontmatter
7. ⬜ Remove old `commands/` directory

**Verification**: Commands exist at new paths with argument-hint in frontmatter

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 3: Update Marketplace Config
**Goal**: Point marketplace.json to new plugin location

1. ⬜ Update `.claude-plugin/marketplace.json` to use `source: "./plugins/dev-workflow"`
2. ⬜ Bump version to 1.2.0

**Verification**: marketplace.json source path is correct

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

### Phase 4: Update Documentation
**Goal**: Update README and CLAUDE.md to reflect new structure

1. ⬜ Update README.md manual install instructions (symlink paths changed)
2. ⬜ Update CLAUDE.md repository structure section

**Verification**: Documentation matches actual structure

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `plugins/dev-workflow/.claude-plugin/plugin.json` | Plugin manifest (name, description, author, version) |
| `plugins/dev-workflow/commands/dev-plan.md` | Moved from root, with argument-hint added |
| `plugins/dev-workflow/commands/dev-checkpoint.md` | Moved from root, with argument-hint added |
| `plugins/dev-workflow/commands/dev-resume.md` | Moved from root, with argument-hint added |

### Modified Files

| File | Changes |
|------|---------|
| `.claude-plugin/marketplace.json` | Change source from `"./"` to `"./plugins/dev-workflow"`, bump version |
| `README.md` | Update manual install symlink paths |
| `CLAUDE.md` | Update repository structure section |

### Deleted Files

| File | Reason |
|------|--------|
| `commands/dev-plan.md` | Moved to plugins/dev-workflow/commands/ |
| `commands/dev-checkpoint.md` | Moved to plugins/dev-workflow/commands/ |
| `commands/dev-resume.md` | Moved to plugins/dev-workflow/commands/ |

---

## Reference Files

- `/Users/andreaserra/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json`: Official marketplace structure
- `/Users/andreaserra/.claude/plugins/marketplaces/claude-plugins-official/plugins/feature-dev/`: Example plugin structure
- `/Users/andreaserra/.claude/plugins/marketplaces/claude-plugins-official/plugins/feature-dev/commands/feature-dev.md`: Example with argument-hint
