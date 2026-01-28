# dev-workflow

Claude Code commands for multi-session development workflows: plan features with structured PRDs, checkpoint progress, and resume across sessions.

These commands are developed and tested for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Overview

Software features rarely fit in a single session. `dev-workflow` gives Claude Code a **plan - build - checkpoint - resume** cycle so context survives across sessions:

1. **Plan** (`/dev-plan`) -- produce a structured PRD in `.dev/<feature-name>/`
2. **Build** -- implement the feature following the PRD phases and gates
3. **Checkpoint** (`/dev-checkpoint`) -- capture progress, git state, decisions, and next steps
4. **Resume** (`/dev-resume`) -- reload the checkpoint, verify context, and pick up where you left off

## Installation

### As a plugin

```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

Commands will be available as `/dev-workflow:dev-plan`, `/dev-workflow:dev-checkpoint`, `/dev-workflow:dev-resume`.

### Manual install

Clone the repo and symlink (or copy) the command files into your Claude Code commands directory:

```bash
git clone https://github.com/andreaserradev-gbj/dev-workflow.git
cd dev-workflow

# Symlink all commands
ln -s "$(pwd)/commands/dev-plan.md" ~/.claude/commands/dev-plan.md
ln -s "$(pwd)/commands/dev-checkpoint.md" ~/.claude/commands/dev-checkpoint.md
ln -s "$(pwd)/commands/dev-resume.md" ~/.claude/commands/dev-resume.md
```

Commands will be available as `/dev-plan`, `/dev-checkpoint`, `/dev-resume`.

## Commands

### `/dev-plan`

Plan a new feature with structured PRD documentation. Walks through three phases:

1. **Understand** -- gather requirements (or infer from inline arguments)
2. **Research** -- explore the codebase using agents
3. **Write** -- produce `.dev/<feature-name>/00-master-plan.md` (and sub-PRDs for complex features)

The PRD uses status markers (`⬜`/`✅`) and phase gates (`⏸️ GATE`) that the other two commands depend on.

### `/dev-checkpoint`

Save progress and generate a continuation prompt. Performs these steps:

1. Identify the active feature
2. Update PRD status markers (`⬜` -> `✅`)
3. Capture git state (branch, last commit, uncommitted changes)
4. Capture session context (decisions, blockers, notes)
5. Generate and save `.dev/<feature-name>/checkpoint.md`

### `/dev-resume`

Resume work from a previous checkpoint. Performs these steps:

1. Find and load the checkpoint
2. Verify context (branch match, staleness, uncommitted changes drift)
3. Build a focused summary with a concrete "Start with" action
4. Wait for confirmation before proceeding
5. Handle discrepancies (missing files, branch mismatch, drift)

## Workflow

```
  /dev-plan                /dev-checkpoint           /dev-resume
 ┌──────────┐            ┌───────────────┐         ┌────────────┐
 │ Understand│            │ Update markers│         │ Load       │
 │ Research  │──build──>  │ Capture git   │──next──>│ Verify     │
 │ Write PRD │            │ Capture context│  session│ Summarize  │
 └──────────┘            │ Save checkpoint│         │ Continue   │
                          └───────────────┘         └────────────┘
                                  │                       │
                                  └───── repeat ──────────┘
```

The cycle repeats: build, checkpoint, resume, build, checkpoint, resume... until the feature is complete.

## Git Tracking

By default, `.dev/` is tracked in git -- PRDs and checkpoints become part of your project history. To exclude it, add to your `.gitignore`:

```
.dev/
```

## Format Reference

The three commands share a contract so they can read each other's output.

### PRD format (produced by `/dev-plan`)

| Element | Format | Used By |
|---------|--------|---------|
| Status markers | `⬜` (pending) / `✅` (done) | `/dev-checkpoint` updates these |
| Phase gates | `⏸️ **GATE**: ... Continue or /dev-checkpoint.` | `/dev-checkpoint` identifies pause points |
| File paths | Backtick-quoted in File Changes Summary | `/dev-resume` reads for context |
| Sub-PRD links | Relative links in Sub-PRD Overview table | `/dev-resume` navigates the full plan |
| Feature directory | `.dev/<feature-name>/` | Both commands locate files here |

### Checkpoint format (produced by `/dev-checkpoint`)

| Element | Format | Used By |
|---------|--------|---------|
| YAML frontmatter | `branch`, `last_commit`, `uncommitted_changes`, `checkpointed` | `/dev-resume` verifies context |
| Semantic XML tags | `<context>`, `<current_state>`, `<next_action>`, `<key_files>`, `<decisions>`, `<blockers>`, `<notes>` | `/dev-resume` scans sections |
| Decisions/Blockers | `<decisions>` and `<blockers>` sections (omitted if empty) | `/dev-resume` surfaces in summary |

### Backward compatibility

Version 1 checkpoints (without YAML frontmatter or XML tags) are handled gracefully -- `/dev-resume` falls back to heading-based parsing.

## Examples

The `examples/` directory contains real artifacts produced during the development of these commands:

- `examples/00-master-plan.md` -- a complete PRD with status markers, phase gates, research findings, architecture decisions, and file changes summary
- `examples/checkpoint.md` -- a v2 checkpoint with YAML frontmatter and semantic XML tags

## Credits

This workflow was inspired by:
- [get-shit-done](https://github.com/glittercowboy/get-shit-done)
- [ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)

## License

MIT
