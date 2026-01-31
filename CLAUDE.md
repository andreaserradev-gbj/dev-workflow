# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that provides three slash commands for multi-session development workflows:
- `/dev-plan` - Plan features with structured PRD documentation
- `/dev-checkpoint` - Save progress and generate continuation prompts
- `/dev-resume` - Resume work from a previous checkpoint

The plugin stores PRDs and checkpoints in a `.dev/<feature-name>/` directory within user projects.

## Repository Structure

```
commands/           # Slash command definitions (markdown files with YAML frontmatter)
  dev-plan.md       # Feature planning command
  dev-checkpoint.md # Progress checkpointing command
  dev-resume.md     # Session resumption command
.claude-plugin/     # Plugin metadata
  plugin.json       # Plugin name, version, description
  marketplace.json  # Marketplace listing info
```

## Plugin Installation

The plugin can be installed via marketplace or manually:

**Marketplace:**
```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

**Manual (symlinks):**
```bash
ln -s "$(pwd)/commands/dev-plan.md" ~/.claude/commands/dev-plan.md
ln -s "$(pwd)/commands/dev-checkpoint.md" ~/.claude/commands/dev-checkpoint.md
ln -s "$(pwd)/commands/dev-resume.md" ~/.claude/commands/dev-resume.md
```

## Command File Format

Each command file uses YAML frontmatter with optional fields:
- `description`: Brief description shown in command help
- `version`: Command version number
- `output`: Path pattern for generated files
- `reads`: Files the command reads

The body contains structured instructions with phases, templates, and rules that Claude follows when the command is invoked.

## Key Conventions

### Status Markers
Commands use these markers to track progress in PRD files:
- `⬜` - Pending/not started
- `✅` - Completed

### Phase Gates
PRDs include gate markers for safe pause points:
```
⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.
```

### Checkpoint XML Tags
Checkpoints wrap content in semantic tags for parsing:
- `<context>`, `<current_state>`, `<next_action>`, `<key_files>`
- `<decisions>`, `<blockers>`, `<notes>` (optional)

### Project Root Detection
Commands determine project root via:
1. `git rev-parse --show-toplevel` for git repos
2. Initial working directory otherwise
