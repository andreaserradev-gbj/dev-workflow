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
    prd-planner.md
    prd-researcher.md
  commands/                     # Slash command definitions
    dev-plan.md
    dev-checkpoint.md
    dev-resume.md
.claude-plugin/
  marketplace.json              # Marketplace metadata
```

## Development

Test plugin changes locally:

```bash
claude --plugin-dir ./plugins/dev-workflow
```

Restart Claude Code to pick up changes.

## Command File Format

YAML frontmatter fields: `description`, `version`, `output`, `reads`

Body contains structured instructions with phases, templates, and rules.

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
