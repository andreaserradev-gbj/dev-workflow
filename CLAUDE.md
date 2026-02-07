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
docs/
  README.codex.md               # Codex usage documentation
.claude-plugin/
  marketplace.json              # Marketplace metadata
```

## Development

Test plugin changes locally:

```bash
claude --plugin-dir ./plugins/dev-workflow
```

Restart Claude Code to pick up changes.

## Skill File Format

Skills follow the [AgentSkills.io](https://agentskills.io) open standard.

YAML frontmatter fields: `name`, `description`, `disable-model-invocation`, `argument-hint`

Body contains structured instructions with phases, templates, and rules. Large templates are extracted into `references/` subdirectories.

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
