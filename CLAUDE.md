# CLAUDE.md

## Project Overview

Claude Code plugin for multi-session development workflows. See [README.md](README.md) for usage and installation.

## Repository Structure

```
plugins/dev-workflow/           # Plugin package
  .claude-plugin/
    plugin.json                 # Plugin metadata
  agents/                       # Subagent definitions for Task tool
    checkpoint-analyzer.md
    context-loader.md
    feature-batch-scanner.md
    prd-planner.md
    prd-researcher.md
  skills/                       # Skill definitions (AgentSkills.io format)
    dev-plan/
      SKILL.md
      references/
        prd-templates.md
    dev-checkpoint/
      SKILL.md
      references/
        checkpoint-template.md
    dev-resume/
      SKILL.md
    dev-status/
      SKILL.md
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
scripts/
  setup.sh                      # One-time contributor setup
tests/
  test-scripts.sh               # Script edge-case tests
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

### Tests

```bash
bash tests/test-scripts.sh
```

Runs automatically via the pre-commit hook.

### Git Hooks (`.githooks/`)

- **pre-commit** — runs `tests/test-scripts.sh`, blocks commit on failure
- **pre-push** — blocks push if `plugins/` changed without a version bump in `marketplace.json`

### Version Bumps

When any file under `plugins/` is modified, bump the `version` in `.claude-plugin/marketplace.json` before pushing to main (or opening a PR targeting main).

## Skill File Format

Skills follow the [AgentSkills.io](https://agentskills.io) open standard.

YAML frontmatter fields: `name`, `description`, `disable-model-invocation`, `argument-hint`, `allowed-tools`

Body contains structured instructions with phases, templates, and rules. Large templates are extracted into `references/` subdirectories. The `allowed-tools` field pre-approves specific tools (e.g., `Bash(git rev-parse:*)`, `Read`) to avoid permission prompts.

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

### Project Root Detection
1. `git rev-parse --show-toplevel` for git repos
2. Initial working directory otherwise
