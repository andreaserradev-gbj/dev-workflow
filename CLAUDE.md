# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Claude Code plugin that provides three slash commands for multi-session development workflows:
- `/dev-plan` — Create structured PRD documentation for features
- `/dev-checkpoint` — Save progress and generate continuation prompts
- `/dev-resume` — Resume work from a previous checkpoint

The commands work together to maintain context across Claude sessions by persisting state to `.dev/<feature-name>/` directories.

## Repository Structure

```
skills/                           # Skill definitions (directories with SKILL.md)
  dev-plan/
    SKILL.md                      # Feature planning skill
    master-plan-template.md       # Template for master PRD
    sub-prd-template.md           # Template for sub-PRDs
  dev-checkpoint/
    SKILL.md                      # Progress saving skill
    checkpoint-template.md        # Template for checkpoint files
  dev-resume/
    SKILL.md                      # Session resumption skill
.claude-plugin/                   # Plugin marketplace metadata
  marketplace.json                # Plugin configuration (name, version, etc.)
```

## How the Commands Work Together

1. `/dev-plan` produces `00-master-plan.md` (and optional sub-PRDs) with status markers (`⬜`/`✅`) and phase gates (`⏸️ GATE`)
2. `/dev-checkpoint` reads PRD files, updates status markers, captures git state, and writes `checkpoint.md`
3. `/dev-resume` reads the checkpoint and PRD files, verifies context (branch, staleness), and resumes work

The commands rely on a shared contract:
- Status markers: `⬜` (pending) / `✅` (done)
- Phase gates: `⏸️ **GATE**: ... Continue or /dev-checkpoint.`
- YAML frontmatter in checkpoints: `branch`, `last_commit`, `uncommitted_changes`, `checkpointed`
- XML tags in checkpoints: `<context>`, `<current_state>`, `<next_action>`, `<key_files>`, `<decisions>`, `<blockers>`, `<notes>`

## Installation Methods

**As plugin:**
```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

**Manual (symlinks):**
```bash
ln -s "$(pwd)/skills/dev-plan" ~/.claude/skills/dev-plan
ln -s "$(pwd)/skills/dev-checkpoint" ~/.claude/skills/dev-checkpoint
ln -s "$(pwd)/skills/dev-resume" ~/.claude/skills/dev-resume
```

## Updating the Plugin

When modifying skills:
1. Update the SKILL.md or template files in `skills/<skill-name>/`
2. Bump `version` in `.claude-plugin/marketplace.json` if publishing
3. Test skills locally with `claude --plugin-dir .` before publishing
