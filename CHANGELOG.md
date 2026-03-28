# Changelog

All notable changes to this project should be documented in this file.

<!-- LOCAL-RELEASES-START -->

## v1.26.2 - 2026-03-28

### Added

- Added compact and detailed view modes to the activity report.
- Added a worked-days metric to report features, with fallback date logic when `Created` is missing.
- Added a hover-only `Go to feature` action in the activity report that opens the matching feature in project view.
- Added compact and detailed project-list controls near search in the projects view.

### Changed

- Sorted activity report projects with active or stale work first, then other non-archived projects, then archived-only projects.
- Persisted the selected report date preset so the active period chip survives reloads and view switches.
- Changed the projects-view compact/detailed control to collapse or expand project cards globally instead of changing feature row content.
- Moved the report compact/detailed control next to the project selector and switched it to icon buttons with tooltips.
- Synced the dashboard build stamp to the marketplace version.

### Fixed

- Fixed activity report completion stats for fully completed features.
- Fixed missing worked-days labels for features that have progress but no explicit `Created` metadata.

## v1.26.1 - 2026-03-28

### Changed

- Bumped the marketplace version to `1.26.1`.

### Fixed

- Fixed activity report completion stats.
- Added a dashboard build/version stamp.
- Updated the dashboard to read its version from `.claude-plugin/marketplace.json` instead of `tools/dev-dashboard/package.json`.

<!-- LOCAL-RELEASES-END -->

<!-- GITHUB-RELEASES-START -->

## v1.26.2 - 2026-03-28

### Added

- Added compact and detailed view modes to the activity report.
- Added a worked-days metric to report features, with fallback date logic when `Created` is missing.
- Added a hover-only `Go to feature` action in the activity report that opens the matching feature in project view.
- Added compact and detailed project-list controls near search in the projects view.

### Changed

- Sorted activity report projects with active or stale work first, then other non-archived projects, then archived-only projects.
- Persisted the selected report date preset so the active period chip survives reloads and view switches.
- Changed the projects-view compact/detailed control to collapse or expand project cards globally instead of changing feature row content.
- Moved the report compact/detailed control next to the project selector and switched it to icon buttons with tooltips.
- Synced the dashboard build stamp to the marketplace version.

### Fixed

- Fixed activity report completion stats for fully completed features.
- Fixed missing worked-days labels for features that have progress but no explicit `Created` metadata.

## v1.26.1 - 2026-03-28

### Changed

- Bumped the marketplace version to `1.26.1`.

### Fixed

- Fixed activity report completion stats.
- Added a dashboard build/version stamp.
- Updated the dashboard to read its version from `.claude-plugin/marketplace.json` instead of `tools/dev-dashboard/package.json`.

## v1.26.0 - 2026-03-27

## Changes

- **Remove dev-status and dev-board skills** — fully replaced by the live dev-dashboard
- **Make dashboard AI-tool-agnostic** — remove all Claude-specific copy-paste commands (Resume, Plan, Board); dashboard now works with any tool that reads/writes `.dev/` PRDs (Claude Code, Codex, Gemini CLI, etc.)
- **Server-side Archive/Restore** — archive and restore actions now execute directly via API with a confirmation dialog, instead of copying shell commands to clipboard
- **New API endpoints** — `POST /api/projects/:project/features/:feature/archive` and `/restore`
- **Updated README** — removed dev-status/dev-board docs, documented dashboard actions

## v1.25.0 - 2026-03-27

Add date-range activity report view to dev-dashboard

## v1.24.0 - 2026-03-26

### Fix

- **Detail panel stale cache**: Fixed a bug where the feature detail panel showed stale data after collapsing and re-expanding. The `useFeatureDetail` hook's module-level cache survived unmount/remount cycles, but the invalidation signal tracking reset on remount, causing the hook to skip refetching.

## v1.23.0 - 2026-03-26

### Dashboard Navigation UX

- **Clickable title**: "Dev Dashboard" heading returns to all-projects view when a project is selected
- **Breadcrumb subtitle**: Shows "All Projects > projectname" navigation path when viewing a single project
- **URL hash navigation**: Project selection synced to URL (`#project=name`) — enables browser back/forward and PWA swipe-back gesture
- **Escape key shortcut**: Press Escape to return to all-projects view
- **Bug fix**: Project selection restored from localStorage/URL was silently cleared on page load because the cleanup effect fired before WebSocket data arrived

## v1.22.0 - 2026-03-26

### PWA support & connection overlay

- **PWA manifest** — installable as a standalone app on desktop/mobile
- **Service worker** — offline fallback page when server is down, with `updateViaCache:none` so dashboard updates are picked up immediately
- **ConnectionOverlay** — full-screen overlay with auto-reconnect indicator when the server disconnects
- **Offline page** — branded fallback with health-check polling that auto-redirects when the server comes back

## v1.21.0 - 2026-03-25

### Fix: Dashboard now watches .dev-archive for live updates

Previously, moving a feature from `.dev/` to `.dev-archive/` while the dashboard was running would cause it to disappear entirely — the watcher saw the removal but never detected the addition to the archive directory. The watcher now monitors both `.dev/` and `.dev-archive/` directories, so archived features appear immediately without needing a dashboard restart.

Also includes the v1.20.0 fix for numbered checkbox step counting (`1. [x]`, `` 1. \`[x]\` ``).

## v1.20.0 - 2026-03-25

### Fix: Dashboard progress for numbered checkbox steps

The dashboard parser now correctly counts numbered checkbox steps (`1. [x]` and `` 1. `[x]` ``), which were previously invisible to the parser. PRDs using this format (e.g. oliocharts security-fix) would show 0/N progress instead of the actual completion count.

## v1.19.0 - 2026-03-25

Support **Status** `[x]`/`[ ]` markers in dashboard parser.

Phases using `- **Status**: \`[x]\` done` instead of emoji markers were not recognized as complete, causing 0% progress on finished features. The parser now falls back to checking for a `**Status**` field when no step-level or title-level markers are found.

## v1.18.0 - 2026-03-25

### .dev-archive support in dev-dashboard

Archived features (from `.dev-archive/` directories) are now surfaced in the dashboard with clean separation from active work.

**New features:**
- Scanner discovers `.dev-archive/` features and marks them with `'archived'` status
- "Archived" filter pill for explicit access; "All" filter excludes archived
- Collapsible archive divider in project cards separates archived from active features
- Archive-only projects grouped under collapsible "Archived Projects" section in both the main view and sidebar
- "Restore" action button copies `mv` command to clipboard
- Feature detail panel resolves paths correctly for archived features

**Bug fixes:**
- Progress fallback for features that track work in sub-PRDs or phase-level markers instead of inline steps (no more 0/0 when sub-PRDs show 17/17 complete)

**UI polish:**
- Archived features render with muted opacity and slate-toned badges
- Gradient bars and feature counts exclude archived from active metrics
- Archived counts shown in project headers and sidebar

## v1.17.0 - 2026-03-25

## Changes

- Treat 0% progress with no checkpoint as stale instead of active
- Add gate status support to dev-board template and agents
- Make header stats and filter counts reflect project/status selection
- SessionBar reflects active status filter with per-status colored chips
- Stale color changed from amber to red across dashboard and board
- Side panel always shows status color bar (selection uses background highlight)
- Collapsible side panel and session bar with localStorage persistence
- Right-side status gradient bar on project cards for quick scanning
- Port visual changes to dev-board template (stale=red, gate status, status bars)
- Fix pre-push hook to enforce version bumps on main pushes

## v1.16.0 — Dashboard UI improvements & ESLint - 2026-03-25

## Changes

- **Wider layout** — Content area expanded from 1024px to 1280px in both dev-dashboard and dev-board, reducing empty gutters on wide screens
- **3-column grid** — Board overview uses 3 columns on xl screens
- **Larger fonts** — Base font size bumped to 18px across both views, pixel-based sizes scaled proportionally
- **Clearer rail selection** — Selected items now use a white left border + blue tint background instead of the barely-visible dark shade
- **Removed notifications** — Stripped the unused notification bell button and its hook
- **WebSocket dev proxy fix** — Client now connects to `/ws` path so Vite properly proxies to the backend in dev mode
- **ESLint + Prettier** — Added typescript-eslint and Prettier for the dashboard, integrated into pre-commit hook
- **Code cleanup** — Fixed unused imports/vars, removed dead `useNotifications.ts`, formatted all source files

## v1.15.0 — Config hot-reload - 2026-03-24

Config file changes are now picked up at runtime — no server restart needed.

### Added
- Hot-reload of `~/.config/dev-dashboard/config.json` — changing `scanDirs` triggers an automatic rescan and pushes updates to all connected browsers
- 5 tests for config watcher (change detection, CLI override precedence, invalid JSON handling, consecutive changes)
- README documentation for dashboard configuration and terminal shell functions

### Changed
- Total test count: 80 (was 75)

## v1.14.0 — Cross-project dev dashboard - 2026-03-24

Cross-project web dashboard that scans configured code directories for `.dev/` folders and shows live feature status in the browser.

### Added
- `/dev-dashboard` skill — launches a local web server with zero-install bundled distribution
- Two-panel UI: project rail (left) + feature detail panel (right)
- Live updates via file watcher and WebSocket
- Parser with emoji shortcode normalization for cross-format PRD compatibility
- Filters, search, collapsible groups, clipboard actions
- esbuild single-file CJS bundle (911KB) for self-contained distribution
- Pre-commit hook enforces bundle freshness when dashboard source changes
- 75 tests covering parser, scanner, state, watcher, WebSocket, and API

## v1.13.0 - 2026-03-24

Remove session-state protocol from skills.

Dashboard now derives status purely from PRD markdown files and checkpoint dates, not from transient JSON state written by skills. This simplifies the skill lifecycle — no more `session-state.json` writes in dev-resume, dev-checkpoint, or dev-wrapup.

### Removed
- `session-state.json` writes from dev-resume, dev-checkpoint, dev-wrapup
- `session-state.json` reads from dev-board and dev-status agents
- `session-state-schema.md` reference doc

## v1.12.0 — Session-state protocol - 2026-03-23

### What's new

**Session-state protocol** — Skills now write `session-state.json` to `.dev/<feature>/` at key lifecycle points, enabling live session awareness across the workflow.

#### Producers
- **dev-resume**: writes `"active"` on session start, `"gate"` at each phase gate
- **dev-checkpoint**: writes `"idle"` after saving checkpoint
- **dev-wrapup**: writes `"idle"` (conditional — only if session-state already exists)

#### Consumers
- **dev-board**: reads `session-state.json` for gate badges (amber) and active session indicators, with graceful fallback to markdown heuristics
- **dev-status**: shows session status alongside features (Building, Gate)

#### Schema
```json
{
  "status": "active" | "gate" | "idle",
  "phase": <number | null>,
  "gate_label": <string | null>,
  "since": "<ISO 8601 timestamp>"
}
```

### Bug fix

- **dev-checkpoint**: Fixed Step 9.5 (branch/worktree proposal on first checkpoint) being consistently skipped — renamed to Step 10 with a required-check callout

## v1.11.0 — Feedback Learning for dev-wrapup - 2026-03-14

## What's New

### Feedback Learning Loop for `/dev-wrapup`

The wrapup skill now learns from your decisions over time. Every time you accept, skip, or reroute a finding, your choice is recorded to `.dev/wrapup-feedback.json`. In subsequent sessions, the skill reads that history and adjusts its behavior:

- **Skip patterns** — Finding types you consistently skip (≥70% skip rate) are suppressed unless exceptionally specific and actionable.
- **Reroute patterns** — If you regularly reroute a finding type to a different destination than proposed, the skill defaults to your preferred destination going forward.
- **Accept patterns** — Finding types you consistently accept are prioritized.
- **Trend detection** — When your recent preferences diverge from historical patterns, the skill favors recent behavior.

### Auto-compaction

The feedback file auto-compacts after 30 sessions, summarizing older records into aggregate statistics while preserving the 20 most recent sessions as raw data. This keeps the file lean without losing learning signal.

### No action required

The feedback loop is fully automatic. Just keep using `/dev-wrapup` as usual — it gets better with each session.

## v1.10.2 — Checkpoint workflow setup improvements - 2026-03-13

## What's changed

- **Branch option for workflow setup**: The checkpoint skill now offers a choice between creating a worktree or just a branch when setting up a dedicated workflow for a feature
- **First checkpoint only**: The workflow setup prompt is now properly skipped on subsequent checkpoints — it only appears when `checkpoint.md` is created for the first time
- **Extracted worktree guide**: Moved workflow setup instructions into a dedicated `references/worktree-guide.md` for better maintainability
- **Documentation**: Added `/dev-board` skill to CLAUDE.md structure and README skill listing

## v1.10.1 — Fix username hallucination in script paths - 2026-03-13

## What's changed

- **Path safety fix**: Skill scripts now use `$HOME` instead of literal home directory paths to prevent username hallucination
- Added public repo privacy rule to CLAUDE.md

## v1.10.0 — Project dashboard skill - 2026-03-13

## What's changed

- **New `/dev-board` skill**: Generates a project dashboard from `.dev/` feature data, producing an HTML board and a stakeholder markdown summary
- Restored Gemini CLI support

## v1.9.0 — Self-contained skills per AgentSkills.io spec - 2026-02-28

## What's Changed

- Distribute scripts and agents into per-skill directories so each skill is fully self-contained per the AgentSkills.io specification
- Update all SKILL.md path references from `../../scripts/` to `scripts/` (one-level-deep, spec-compliant)
- Add `agents` array to `plugin.json` for per-skill agent registration
- Add checksum sync tests (8 new tests) to catch drift between duplicated script copies
- Delete shared `plugins/dev-workflow/scripts/` and `plugins/dev-workflow/agents/` directories
- Bump version to 1.9.0

**Full Changelog**: https://github.com/andreaserradev-gbj/dev-workflow/compare/v1.8.0...v1.9.0

## v1.8.0 — Session wrap-up skill - 2026-02-23

## Summary

- Add `/dev-wrapup` skill for end-of-session review: scans conversation for learnings (corrections, conventions, gotchas) and improvement signals (friction, skill gaps, automation opportunities)
- Single-pass analysis with tool-agnostic routing to project docs, scoped rules, user global, personal project, or personal memory
- Decision tree with guard rails and self-check to prevent over-routing to personal memory
- Every proposed change requires explicit user confirmation before being applied
- Integrate into `/dev-checkpoint` flow via prose suggestion at end of session
- Cross-tool destination mapping (Claude Code, Codex, Gemini CLI) using runtime-resolved variables
- Bump version to 1.8.0

## v1.7.0 — Input validation and script extraction - 2026-02-16

## Summary

- Extract inline validation logic from all four SKILL.md files into shared `scripts/validate.sh` with four modes (`checkpoint-path`, `feature-path`, `normalize`, `slug`)
- Add input validation with slug enforcement and path-traversal checks to prevent command injection via feature names
- Replace `git add .` with `git add -u` in dev-checkpoint to avoid staging sensitive files
- Extract deterministic shell logic into reusable scripts:
  - `scripts/discover.sh` — project root detection, feature/checkpoint discovery
  - `scripts/git-state.sh` — git branch, commit, and status gathering
  - `scripts/worktree-setup.sh` — worktree eligibility check and creation
- Add `tests/test-scripts.sh` with 23 edge-case tests
- Add `.githooks/` with pre-commit (runs tests) and pre-push (version bump check) hooks
- Add `scripts/setup.sh` for one-time contributor setup
- Add old status report cleanup to dev-status skill

## v1.6.0 - 2026-02-15

Add optional commit step to dev-checkpoint

- Adds a new **Step 10** to `/dev-checkpoint` that offers to commit all current changes after checkpoint is saved
- Step follows the same conditional skip + STOP gate + accept/decline pattern as the worktree setup step
- Runs a fresh `git status --porcelain` check and derives the commit message from the checkpoint context

## v1.5.5 - 2026-02-14

Add optional worktree setup step to dev-checkpoint (#4)

- Adds a new **Step 9.5** to `/dev-checkpoint` that offers to set up a git worktree-based workflow on the first-ever checkpoint for a feature
- When accepted, creates a feature branch + worktree in a sibling directory, moves PRD files there, commits them, and updates checkpoint frontmatter
- Step is automatically skipped when not on `main`/`master` or when the feature branch already exists

## v1.5.4 - 2026-02-12

Add allowed-tools to skill frontmatter for reduced permission prompts

- Pre-approve `git rev-parse`, `git branch`, `git log`, `git status`, and `Read` in each skill's YAML frontmatter
- Reduces permission prompts during `/dev-plan`, `/dev-checkpoint`, `/dev-resume`, and `/dev-status` execution
- Document `allowed-tools` field in CLAUDE.md

## v1.5.3 - 2026-02-09

Fix skill name references in README

- Update old `dev-workflow:dev-plan` prefix format to `/dev-plan`
- Replace leftover "commands" wording with "skills"

## v1.5.2 - 2026-02-09

Add skill prompt examples to documentation

- Add example invocations for each skill in `README.md` (slash-command and natural-language)
- Add Examples subsection to `docs/README.codex.md` with natural-language prompts
- Add Examples subsection to `docs/README.gemini.md` with natural-language prompts

## v1.5.1 - 2026-02-08

Add Gemini CLI support

- Add `.gemini/INSTALL.md` with three installation options (direct install, clone+link, manual symlink)
- Add `docs/README.gemini.md` with comprehensive usage guide
- Add Gemini CLI section to `README.md`

## v1.5.0 - 2026-02-07

## What's New

- **AgentSkills.io format**: Commands migrated to `SKILL.md` standard with YAML frontmatter, improving cross-platform compatibility
- **Codex support**: New `.codex/INSTALL.md` and `docs/README.codex.md` for installing skills in OpenAI Codex via native skill discovery (clone + symlink)
- **Template extraction**: Large templates moved to `references/` subdirectories, reducing skill file size

## Installation

### Claude Code (plugin)
```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

### Codex
Tell Codex:
> Fetch and follow instructions from https://raw.githubusercontent.com/andreaserradev-gbj/dev-workflow/refs/heads/main/.codex/INSTALL.md

## v1.4.2 - 2026-02-07

## What's New

### Behavioral Guardrails

- **Checkpoint save-only mode** — `/dev-checkpoint` now strictly saves progress without investigating bugs or starting fixes
- **Pattern-first implementation** — `/dev-resume` reads existing code patterns before writing new code, preventing "built from scratch" issues
- **Step-level confirmation** — `/dev-resume` confirms each step before advancing, preventing premature task jumps
- **PRD constraints section** — `/dev-plan` templates now include reuse requirements, pattern conventions, and anti-patterns to avoid
- **Actionable verification** — Phase verification in PRDs uses checklists with specific commands instead of free-text descriptions
- **Researcher reuse tables** — `prd-researcher` agent now surfaces existing utilities to reuse and anti-patterns to avoid
- **Planner simplicity bias** — `prd-planner` agent prefers reuse over new code and simpler solutions

### Token Optimization

- Reduced command prompt sizes by ~159 lines across all three commands
- Removed redundant sections, condensed verbose instructions, collapsed duplicate template examples

## v1.4.1 - Agent Model Optimization - 2026-02-06

## What's Changed

Added model hints to agent invocations for cost and latency optimization:

- **prd-researcher**: `model=sonnet` — balanced quality for codebase research
- **checkpoint-analyzer**: `model=haiku` — fast, lightweight checkpoint parsing
- **context-loader**: `model=haiku` — fast context and git state comparison
- **feature-batch-scanner**: `model=haiku` — fast status scanning
- **prd-planner**: inherits user's model (no change) — full reasoning for architecture design

## v1.4.0 - Feature Status Command - 2026-02-04

## 📊 Feature Release

### Added

- **`/dev-status`** - New command to show status of all features
  - Scans `.dev/` directory for all feature PRDs
  - Displays completion status for each feature
  - Offers to archive completed features
  - Quick overview of project development state

- New `feature-batch-scanner.md` agent for efficient status scanning

### Improved

- Better project-wide visibility into development progress
- Streamlined feature lifecycle management
- Easy cleanup of completed work

### Usage

```
/dev-status
```

Shows all features with their current status and allows archiving completed ones.

## v1.3.4 - Agent Type Fix - 2026-02-04

## 🔧 Bug Fix Release

### Fixed

- Fixed agent `subagent_type` to use fully-qualified names
- Agents now correctly reference `dev-workflow:agent-name` format
- Resolves issues with agent discovery in Claude Code

### Technical

- Updated all agent definitions to use proper namespacing
- Ensures compatibility with Claude Code's agent resolution system

## v1.3.3 - Phase Gate Enforcement - 2026-02-04

## ⏸️ Workflow Improvement

### Changed

- Enforced hard stop at phase gates in `/dev-resume` command
- Users must explicitly continue or checkpoint at each phase boundary
- Prevents accidental skipping of important workflow steps

### Improved

- Clearer phase transition points
- Better control over multi-phase development workflows
- Reduced risk of missing checkpoint opportunities

## v1.3.2 - Command Cleanup - 2026-02-04

## 🧹 Maintenance Release

### Fixed

- Removed hardcoded model definitions from command files
- Commands now work with any model configuration
- Consistent behavior across different Claude Code setups

### Changed

- Command definitions are now more portable
- Completes the cleanup started in v1.3.1

## v1.3.1 - Agent Cleanup - 2026-02-04

## 🧹 Maintenance Release

### Fixed

- Removed hardcoded model definitions from agent files
- Agents now inherit model settings from parent context
- Better compatibility with different Claude Code configurations

### Changed

- Agent definitions are now more portable across environments

## v1.3.0 - Subagent Support - 2026-02-04

## 🤖 Feature Release

### Added

- Read-only subagents for PRD workflow commands
- New `agents/` directory with specialized agent definitions:
  - `context-loader.md` - Parse checkpoints and compare git state
  - `prd-researcher.md` - Research codebase to populate PRD findings
  - `prd-planner.md` - Design implementation structure for PRDs
  - `checkpoint-analyzer.md` - Analyze sessions for checkpoint generation

### Improved

- Better separation of concerns in workflow commands
- More efficient codebase exploration during planning
- Parallel research capabilities for faster PRD creation

## v1.2.1 - Privacy Rules - 2026-02-04

## 🔒 Security Update

### Added

- Privacy rules to prevent sensitive data from being included in PRDs
- Automatic filtering of credentials, API keys, and personal information
- Guidelines for handling confidential project details

### Security

- PRD templates now include privacy-aware sections
- Checkpoint data excludes sensitive information by default

## v1.2.0 - Marketplace Format - 2026-02-04

## 🏪 Major Refactor

### Changed

- Refactored plugin structure to official Claude Code marketplace format
- New directory structure under `plugins/dev-workflow/`
- Added `.claude-plugin/marketplace.json` for marketplace metadata

### Structure

```
plugins/dev-workflow/
  .claude-plugin/
    plugin.json
  commands/
    dev-plan.md
    dev-checkpoint.md
    dev-resume.md
.claude-plugin/
  marketplace.json
```

### Improved

- Better compatibility with Claude Code plugin system
- Cleaner separation between marketplace metadata and plugin code

## v1.1.0 - Improved Clarity - 2026-02-04

## ✨ Minor Release

### Improved

- Command instructions are clearer and more concise
- Reduced verbosity in command outputs
- Better user experience with streamlined prompts

### Changed

- Simplified command flow for all three commands
- Cleaner output formatting

## v1.0.1 - Plugin Structure Fix - 2026-02-04

## 🔧 Bug Fix Release

### Fixed

- Plugin structure now uses relative source paths correctly
- Removed redundant plugin.json file that caused conflicts
- Fixed path resolution issues when plugin is installed from different locations

## v1.0.0 - Initial Release - 2026-02-04

## 🎉 Initial Release

First public release of the dev-workflow plugin for Claude Code.

### Features

- **`/dev-plan`** - Plan new features with structured PRD documentation
- **`/dev-checkpoint`** - Save progress and generate continuation prompts for next session
- **`/dev-resume`** - Resume work from a previous session checkpoint

### Highlights

- Multi-session development workflow support
- Structured PRD templates with phases and status markers
- Checkpoint system with XML tags for context preservation
- Session continuity across Claude Code restarts

<!-- GITHUB-RELEASES-END -->
