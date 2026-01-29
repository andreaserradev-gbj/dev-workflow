<div align="center">

# dev-workflow

**Claude Code commands for multi-session development workflows: plan features with structured PRDs, checkpoint progress, and resume across sessions.**

> **Before:** *"Here's where I left off: I was working on the auth feature, finished the login endpoint, the tests are passing, next step is adding the refresh token logic, oh and I decided to use Redis for session storage because..."*
>
> **After:** `/dev-resume`

**[Installation](#installation) · [How It Works](#how-it-works) · [Commands](#commands) · [Why This Workflow?](#why-this-workflow)**

</div>

## Installation

### As a plugin

```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

Commands will be available as `/dev-workflow:dev-plan`, `/dev-workflow:dev-checkpoint`, `/dev-workflow:dev-resume`.

<details>
<summary><strong>Updating & Troubleshooting</strong></summary>

To update to the latest version:

```
/plugin marketplace update dev-workflow
```

If the plugin doesn't load correctly after updating, clear the cache and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/dev-workflow
rm -rf ~/.claude/plugins/marketplaces/dev-workflow
```

Then in Claude Code:

```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

</details>

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

1. **Plan** — Run `/dev-plan` in edit mode (not plan mode, which would skip saving the detailed PRD)
2. **Iterate** — Draft and refine the PRD through a few iterations
3. **Checkpoint** — Run `/dev-checkpoint` to capture progress
4. **Restart** — Exit and reopen Claude (better than clearing context)
5. **Resume** — Run `/dev-resume` in plan mode so Claude creates its own implementation plan
6. **Build** — Switch to edit mode with cleared context for focused work
7. **Repeat** — Checkpoint before context fills up, then cycle continues

## Commands

### `/dev-plan`

> **Run in:** edit mode

Plan a new feature with structured PRD documentation. Walks through three phases:

1. **Understand** — gather requirements (or infer from inline arguments)
2. **Research** — explore the codebase using agents
3. **Write** — produce `.dev/<feature-name>/00-master-plan.md` (and sub-PRDs for complex features)

The PRD uses status markers (`⬜`/`✅`) and phase gates (`⏸️ GATE`) that the other two commands depend on.

### `/dev-checkpoint`

> **Run in:** edit mode

Save progress and generate a continuation prompt. Performs these steps:

1. Identify the active feature
2. Update PRD status markers (`⬜` -> `✅`)
3. Capture git state (branch, last commit, uncommitted changes)
4. Capture session context (decisions, blockers, notes)
5. Generate and save `.dev/<feature-name>/checkpoint.md`

### `/dev-resume`

> **Run in:** plan mode

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

By default, `.dev/` is tracked in git — PRDs and checkpoints become part of your project history. To exclude it, add to your `.gitignore`:

```
.dev/
```

## Why This Workflow?

> **TL;DR:** Complex features overflow context windows. This workflow saves structured progress to disk so you can clear context and resume without re-explaining everything.

When implementing complex features, my usual approach is to start in plan mode and ask Claude to explore specific files, architecture patterns, or areas of the codebase while thinking through a particular problem. I iterate based on the findings. Sometimes it's a single pass, but often there are multiple rounds of exploration and brainstorming. For complex features, this can consume nearly the entire context window before arriving at a solution.

In these scenarios, I found myself repeatedly asking Claude to save the plan to a project folder so I could digest the information, verify the codebase findings, and adjust course when Claude's analysis was incomplete or when it surfaced code I hadn't considered. Saving plans to Claude's internal folders wasn't enough for complex cases, which is why I kept asking to persist PRDs in my project.

After finalizing a plan, the build phase often spans multiple sessions due to context constraints. I needed a way to tell Claude where to restart and how to persist progress. Updating the entire PRD was one solution, but loading it at startup created a lot of context for Claude to digest every time. So I created a separate checkpoint file to store only the insights from the previous iteration, and start the next session from there.

This led to writing nearly the same "resume from checkpoint" prompt over and over, which made me think: why not consolidate this pattern into a reusable workflow? The **plan → build → checkpoint → resume** cycle is just context engineering best practices adapted to fit my working style.

### How I Use It

I replace plan mode with `/dev-plan`. Why not run it *in* plan mode? Because plan mode would shift focus toward implementation rather than PRD creation. Claude would skip saving the detailed PRD. After drafting and refining the PRD through a few iterations, I invoke `/dev-checkpoint` to capture progress.

I exit and reopen Claude (it seems better than clearing the context) and run `/dev-resume` in plan mode. Why plan mode here? Because I want Claude to create its own implementation plan based on the checkpoint. When I switch to edit mode, I choose to clear context so Claude starts fresh with only the details for the focused step.

I stop Claude before the context fills up with too many details, ask it to commit, and create a new checkpoint. Sometimes the checkpoint is a natural pause to run manual tests, add unit tests, or verify behavior. Other times it's simply a signal to proceed to the next phase. It depends on the task. Frontend work has different checkpointing needs than backend, API changes differ from refactors, and so on.

Then I clear the context, and the cycle repeats.

### A Note on Master and Sub-PRDs

For very complex features where the context requirements are substantial, I found that a single PRD becomes too long and cluttered. This ties back to the same principle: you want Claude to start with the least context possible to avoid drift or hallucination. So when needed, I ask Claude during the `/dev-plan` phase to break the PRD into sub-tasks, each with its own focused document. Claude usually doesn't do this by itself, so you have to be explicit about it.

## Credits

This workflow was inspired by:
- [get-shit-done](https://github.com/glittercowboy/get-shit-done)
- [ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)

## License

MIT
