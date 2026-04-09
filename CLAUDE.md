# CLAUDE.md

## Project Overview

Claude Code plugin for multi-session development workflows. See [README.md](README.md) for usage and installation.

## Repository Structure

```
plugins/dev-workflow/           # Plugin package
  .claude-plugin/
    plugin.json                 # Plugin metadata (includes agents array)
  skills/                       # Self-contained skills (AgentSkills.io format)
    dev-plan/
      SKILL.md
      references/prd-templates.md
      scripts/discover.sh, validate.sh, dev-workflow.cjs
      agents/prd-researcher.md, prd-planner.md
    dev-checkpoint/
      SKILL.md
      references/checkpoint-template.md, worktree-guide.md
      scripts/discover.sh, validate.sh, git-state.sh, worktree-setup.sh, dev-workflow.cjs
    dev-resume/
      SKILL.md
      scripts/discover.sh, validate.sh, git-state.sh, dev-workflow.cjs
    dev-wrapup/
      SKILL.md
      scripts/discover.sh
    dev-dashboard/
      SKILL.md
      scripts/start.sh
      dashboard/                    # Bundled server + client (committed build artifact)
        server/index.cjs
        client/
# Generated in user's project (not in plugin repo)
.dev/wrapup-feedback.json        # Wrapup feedback history (auto-compacting)
.codex/
  INSTALL.md                    # Installation instructions for Codex
.gemini/
  INSTALL.md                    # Installation instructions for Gemini CLI
docs/
  README.codex.md               # Codex usage documentation
  README.gemini.md              # Gemini CLI usage documentation
.claude-plugin/
  marketplace.json              # Marketplace metadata
.githooks/                      # Git hooks (activate with scripts/setup.sh)
  pre-commit                    # Runs tests before commit
  pre-push                      # Enforces version bumps
tools/dev-dashboard/            # Cross-project live dashboard
  bin/dev-dashboard              # Shell entry point
  src/server/                    # Fastify backend (scanner, parser, watcher, API, WS)
  src/client/                    # Preact frontend (portfolio view, detail panels)
  src/shared/                    # Shared TypeScript types
  test/                          # Vitest tests + fixtures
tools/dev-workflow-core/         # Shared workflow core (parser, scanner, types)
  src/                           # TypeScript source
  test/                          # Vitest tests + fixtures
tools/dev-workflow-cli/          # Agent-first CLI over the shared core
  src/commands/                  # CLI commands (feature-show, progress-summary, etc.)
  test/                          # Vitest tests
  scripts/bundle.js              # Bundles CLI to plugins/dev-workflow/bin/dev-workflow.cjs
plugins/dev-workflow/bin/
  dev-workflow.cjs               # Bundled CLI artifact (canonical copy)
scripts/
  setup.sh                      # One-time contributor setup
tests/
  test-scripts.sh               # Script edge-case tests + cross-skill sync checks
```

## Development

### Setup

After cloning, run the setup script to activate git hooks:

```bash
bash scripts/setup.sh
```

Test plugin changes locally:

```bash
claude --plugin-dir ./plugins/dev-workflow
```

Restart Claude Code to pick up changes.

### Dashboard Bundle

After modifying `tools/dev-dashboard/`, rebuild the bundle that ships with the plugin:

```bash
cd tools/dev-dashboard && npm run bundle
```

This builds the Vite client + esbuild-bundles the server into `plugins/dev-workflow/skills/dev-dashboard/dashboard/`. The bundle is a committed build artifact — commit it alongside source changes. The pre-commit hook blocks commits that change dashboard source without updating the bundle.

### CLI Bundle

After modifying `tools/dev-workflow-cli/` or `tools/dev-workflow-core/`, rebuild the CLI bundle:

```bash
cd tools/dev-workflow-cli && npm run bundle
```

This esbuild-bundles the CLI into `plugins/dev-workflow/bin/dev-workflow.cjs` (canonical copy). Each skill that uses the CLI (`dev-resume`, `dev-checkpoint`, `dev-plan`) has its own copy at `scripts/dev-workflow.cjs` to stay self-contained. After rebuilding, copy the canonical bundle to each skill:

```bash
cp plugins/dev-workflow/bin/dev-workflow.cjs plugins/dev-workflow/skills/dev-resume/scripts/dev-workflow.cjs
cp plugins/dev-workflow/bin/dev-workflow.cjs plugins/dev-workflow/skills/dev-checkpoint/scripts/dev-workflow.cjs
cp plugins/dev-workflow/bin/dev-workflow.cjs plugins/dev-workflow/skills/dev-plan/scripts/dev-workflow.cjs
```

The pre-commit hook blocks commits where CLI source changed without updating the bundle. The test suite (`tests/test-scripts.sh`) blocks commits where the per-skill copies differ from the canonical `bin/dev-workflow.cjs`.

The CLI is agent-first: designed for structured output (`--json`), deterministic exit codes, and consumption by skill scripts — not as a user-facing terminal tool. Command names are intentionally promotable to a public CLI later without redesign, but no stability guarantees are made at this stage.

### Dashboard Actions

The dashboard is AI-tool-agnostic — it works with any tool that reads/writes `.dev/` PRDs (Claude Code, Codex, Gemini CLI, etc.).

**Server-side actions** (executed via API with confirmation prompt):
- **Archive** — moves a completed feature from `.dev/` to `.dev-archive/` (`POST /api/projects/:project/features/:feature/archive`)
- **Restore** — moves an archived feature back from `.dev-archive/` to `.dev/` (`POST /api/projects/:project/features/:feature/restore`)

**Clipboard utility**:
- **Copy as Markdown** — copies the activity report as a formatted markdown table (in Report view)

### Tests

```bash
bash tests/test-scripts.sh
```

Runs automatically via the pre-commit hook.

### Git Hooks (`.githooks/`)

- **pre-commit** — runs `tests/test-scripts.sh` (including cross-skill sync checks for shared scripts and CLI copies), blocks commit if dashboard or CLI source changed without rebuilding the respective bundle
- **pre-push** — syncs the GitHub releases section of `CHANGELOG.md`, blocks push if that sync changes the file, blocks push if `plugins/` changed without a version bump in `marketplace.json`, and blocks version bumps that do not have a matching local changelog entry

### Version Bumps

When any file under `plugins/` is modified, bump the `version` in `.claude-plugin/marketplace.json` before pushing to main (or opening a PR targeting main).

### Release Workflow

`CHANGELOG.md` is the source of truth for release notes.

For a new release:

1. Bump the version in `.claude-plugin/marketplace.json`
2. Add or scaffold the matching local changelog entry in `CHANGELOG.md`
3. Commit and push to `main`
4. GitHub Actions creates the `vX.Y.Z` release automatically from the local changelog entry

Helper scripts:

- `node scripts/scaffold-local-release-notes.mjs` — scaffold a local changelog entry for the current marketplace version from commits since the last tag
- `node scripts/sync-changelog-from-github-releases.mjs` — refresh the generated GitHub releases section in `CHANGELOG.md`

`CHANGELOG.md` contains two sections:

- **Local releases** — manual entries for versions not yet published on GitHub
- **GitHub releases** — generated from the exact published GitHub release bodies

## Skill File Format

Skills follow the [AgentSkills.io](https://agentskills.io) open standard.

YAML frontmatter fields: `name`, `description`, `disable-model-invocation`, `argument-hint`, `allowed-tools`

Body contains structured instructions with phases, templates, and rules. Large templates are extracted into `references/` subdirectories. The `allowed-tools` field pre-approves specific tools (e.g., `Bash(git rev-parse:*)`, `Read`) to avoid permission prompts.

When skills target cross-tool destinations (e.g., project docs, scoped rules), reference file paths via variables resolved at runtime from discovery (e.g., `$PROJECT_DOCS`, `$SCOPED_RULES_DIR`), not hardcoded tool-specific names like `CLAUDE.md` or `.claude/rules/`.

## Key Conventions

### Status Markers
- `⬜` - Pending
- `✅` - Completed

### Phase Gates
```
⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
```

### Checkpoint XML Tags
Required: `<context>`, `<current_state>`, `<next_action>`, `<key_files>`
Optional: `<decisions>`, `<blockers>`, `<notes>`

### Public Repo — No Private References
`.dev/` PRD files and all generated output (checkpoints, summaries, commit messages) must not contain references to external private repositories, personal folder paths, absolute paths with usernames, or user-specific tooling. Use relative paths and generic descriptions.

### Project Root Detection
1. `git rev-parse --show-toplevel` for git repos
2. Initial working directory otherwise
