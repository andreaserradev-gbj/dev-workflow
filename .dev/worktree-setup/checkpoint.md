---
branch: main
last_commit: 73e2c17 Add allowed-tools to skill frontmatter for reduced permission prompts
uncommitted_changes: true
checkpointed: 2026-02-14T00:00:00Z
---

Read the following PRD files in order:

1. .dev/worktree-setup/00-master-plan.md

<context>
## Context

**Goal**: Add optional worktree setup step to `/dev-checkpoint` that automates branch+worktree creation, PRD file move, and commit on first-ever checkpoint.
**Current phase**: Phase 1 — Add Worktree Setup Step to dev-checkpoint
**Key completions**: Research complete, architecture decided, PRD written
</context>

<current_state>
## Current Progress

- ✅ Research: Analyzed codebase patterns (STOP gates, git state capture, allowed-tools, feature naming)
- ✅ Architecture decision: Step 9.5 in dev-checkpoint, `mv` instead of `cp`+`rm`, `git worktree add -b`, first-time detection via `git branch --list`
- ✅ PRD written: `.dev/worktree-setup/00-master-plan.md`
- ⬜ Update `allowed-tools` frontmatter: Add `Bash(git worktree:*)`, `Bash(git add:*)`, `Bash(git commit:*)` to dev-checkpoint SKILL.md
- ⬜ Add Step 9.5 section: Implement worktree setup flow with conditions, STOP gate, 3-command execution, and post-execution message
- ⬜ Verification: Test the full flow
</current_state>

<next_action>
## Next Steps

Phase 1, Step 1 (dev-checkpoint/SKILL.md frontmatter):
- Add `Bash(git worktree:*) Bash(git add:*) Bash(git commit:*)` to the `allowed-tools` line

Phase 1, Step 2 (dev-checkpoint/SKILL.md body):
- Add Step 9.5 after Step 9 with:
  - Conditions: git repo AND on main/master AND `git branch --list feature/<feature-name>` is empty
  - STOP gate explaining what will happen (files move, session must end)
  - If accepted: `git worktree add -b feature/<name> ../<project>-<name>`, then `mkdir -p ../<project>-<name>/.dev && mv .dev/<name> ../<project>-<name>/.dev/`, then `git -C ../<project>-<name> add .dev && git -C ../<project>-<name> commit -m "Add PRD for <name>"`
  - Post-execution: tell user files were moved, end session, continue from worktree directory
</next_action>

<key_files>
## Key Files

- Target file: plugins/dev-workflow/skills/dev-checkpoint/SKILL.md
- PRD: .dev/worktree-setup/00-master-plan.md
- Reference pattern: plugins/dev-workflow/skills/dev-resume/SKILL.md (branch mismatch handling)
- Checkpoint template: plugins/dev-workflow/skills/dev-checkpoint/references/checkpoint-template.md
</key_files>

<decisions>## Decisions
- Only modify `/dev-checkpoint`, not `/dev-plan` — doing it in `/dev-plan` would break the subsequent checkpoint since PRD files get moved
- Use `mv` instead of `cp` + `rm` — atomic, simpler
- Use `git worktree add -b` — creates branch + worktree in one command
- Detect first-time via `git branch --list` — no extra state files
- Place as Step 9.5 after the checkpoint summary (Step 9)
- Must clearly instruct user to end session and switch to worktree directory after files are moved</decisions>

<notes>## Notes
- User provided a manual simulation showing 4-step friction: create branch+worktree → copy files → commit → delete from main
- The worktree path pattern is `../<project-basename>-<feature-name>` (sibling of project root)
- Privacy: use relative paths in all user-facing output, never absolute paths with usernames</notes>

---

Please continue with Phase 1 implementation: update the `allowed-tools` frontmatter and add Step 9.5 to `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md`, following the specifications in the PRD.
