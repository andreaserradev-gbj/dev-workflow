<div align="center">

# dev-workflow

Claude Code commands for multi-session development workflows: plan features with structured PRDs, checkpoint progress, and resume across sessions.

Software features rarely fit in a single session. `dev-workflow` gives Claude Code a **plan → build → checkpoint → resume** cycle so context survives across sessions.

**[Installation](#installation) · [How It Works](#how-it-works) · [Commands](#commands) · [Why This Workflow?](#why-this-workflow)**

</div>

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

## How It Works

1. **Plan** (`/dev-plan`) -- produce a structured PRD in `.dev/<feature-name>/`
2. **Build** -- implement the feature following the PRD phases and gates
3. **Checkpoint** (`/dev-checkpoint`) -- capture progress, git state, decisions, and next steps
4. **Resume** (`/dev-resume`) -- reload the checkpoint, verify context, and pick up where you left off

## Commands

### `/dev-plan`

**Run in:** edit mode

Plan a new feature with structured PRD documentation. Walks through three phases:

1. **Understand** -- gather requirements (or infer from inline arguments)
2. **Research** -- explore the codebase using agents
3. **Write** -- produce `.dev/<feature-name>/00-master-plan.md` (and sub-PRDs for complex features)

The PRD uses status markers (`⬜`/`✅`) and phase gates (`⏸️ GATE`) that the other two commands depend on.

### `/dev-checkpoint`

**Run in:** edit mode

Save progress and generate a continuation prompt. Performs these steps:

1. Identify the active feature
2. Update PRD status markers (`⬜` -> `✅`)
3. Capture git state (branch, last commit, uncommitted changes)
4. Capture session context (decisions, blockers, notes)
5. Generate and save `.dev/<feature-name>/checkpoint.md`

### `/dev-resume`

**Run in:** plan mode

Resume work from a previous checkpoint. Performs these steps:

1. Find and load the checkpoint
2. Verify context (branch match, staleness, uncommitted changes drift)
3. Build a focused summary with a concrete "Start with" action
4. Wait for confirmation before proceeding
5. Handle discrepancies (missing files, branch mismatch, drift)

## Workflow

```
┌────────────┐       ┌──────────────────┐       ┌──────────────┐
│            │       │                  │       │              │
│ /dev-plan  │──────►│ /dev-checkpoint  │──────►│ /dev-resume  │
│            │ build │                  │ next  │              │
└────────────┘       └──────────────────┘session└──────────────┘
                              ▲                        │
                              │         build          │
                              └────────────────────────┘
```

The cycle repeats: build, checkpoint, resume, build, checkpoint, resume... until the feature is complete.

## Git Tracking

By default, `.dev/` is tracked in git -- PRDs and checkpoints become part of your project history. To exclude it, add to your `.gitignore`:

```
.dev/
```

## Why This Workflow?

When implementing complex features, my usual approach is to start in plan mode and ask Claude to explore specific files, architecture patterns, or areas of the codebase while thinking through a particular problem. I iterate based on the findings. Sometimes it's a single pass, but often there are multiple rounds of exploration and brainstorming. For complex features, this can consume nearly the entire context window before arriving at a solution.

In these scenarios, I found myself repeatedly asking Claude to save the plan to a project folder so I could digest the information, verify the codebase findings, and adjust course when Claude's analysis was incomplete or when it surfaced code I hadn't considered. Saving plans to Claude's internal folders wasn't enough for complex cases, which is why I kept asking to persist PRDs in my project.

After finalizing a plan, the build phase often spans multiple sessions due to context constraints. I needed a way to tell Claude where to restart and how to persist progress. Updating the entire PRD was one solution, but loading it at startup created a lot of context for Claude to digest every time. So I created a separate checkpoint file to store only the insights from the previous iteration, and start the next session from there.

This led to writing nearly the same "resume from checkpoint" prompt over and over, which made me think: why not consolidate this pattern into a reusable workflow? The **plan → build → checkpoint → resume** cycle is just context engineering best practices adapted to fit my working style.

### How I Use It

**Simple features or bug fixes:** I start with a fresh prompt in plan mode, switch to edit mode, and complete the session.

**Complex features (the majority of my work):** I replace plan mode with `/dev-plan`. Why not run it *in* plan mode? Because plan mode would shift focus toward implementation rather than PRD creation. Claude would skip saving the detailed PRD. After drafting and refining the PRD through a few iterations, I invoke `/dev-checkpoint` to capture progress.

Then I clear the context (or exit and reopen Claude) and run `/dev-resume` in plan mode. Why plan mode here? Because I want Claude to create its own implementation plan based on the checkpoint. When I switch to edit mode, I choose to clear context so Claude starts fresh with only the details for the focused step.

I stop Claude before the context fills up with too many details, ask it to commit, and create a new checkpoint. Sometimes the checkpoint is a natural pause to run manual tests, add unit tests, or verify behavior. Other times it's simply a signal to proceed to the next phase. It depends on the task. Frontend work has different checkpointing needs than backend, API changes differ from refactors, and so on. Then I clear the context, and the cycle repeats.

### A Note on Master and Sub-PRDs

For very complex features where the context requirements are substantial, I found that a single PRD becomes too long and cluttered. This ties back to the same principle: you want Claude to start with the least context possible to avoid drift or hallucination. So when needed, I ask Claude during the `/dev-plan` phase to break the PRD into sub-tasks, each with its own focused document. Claude usually doesn't do this by itself, so you have to be explicit about it.

## Credits

This workflow was inspired by:
- [get-shit-done](https://github.com/glittercowboy/get-shit-done)
- [ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)

## License

MIT
