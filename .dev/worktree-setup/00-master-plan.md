# Worktree Setup - Master Plan

**Status**: Complete
**Created**: 2026-02-14
**Last Updated**: 2026-02-14

---

## Executive Summary

Add an optional step at the end of `/dev-checkpoint` (first-ever checkpoint only) that offers to set up a git worktree-based workflow. When accepted, it creates a feature branch, a worktree in a sibling directory, moves the PRD files there, commits them, and instructs the user to end the session and continue work from the new worktree directory.

This removes the friction of manually creating branches, copying files, and cleaning up — turning a 4-step manual process into a single confirmation.

---

## Research Findings

### Codebase Patterns
- **STOP gates**: All skills use `**STOP.**` patterns before irreversible actions — reuse for worktree confirmation (`dev-checkpoint/SKILL.md:98`)
- **Git state capture**: Step 5 already runs `git branch --show-current` — reuse to check if on main/master (`dev-checkpoint/SKILL.md:88`)
- **Feature name from directory**: Step 1 identifies `<feature-name>` from `.dev/` subdirectories — reuse for branch naming (`dev-checkpoint/SKILL.md:33-54`)
- **allowed-tools frontmatter**: Pre-approves specific bash commands to avoid permission prompts (`dev-checkpoint/SKILL.md:8`)
- **Branch in checkpoint frontmatter**: Checkpoint template already stores `branch` field — will reflect the new branch after move

### Dependencies
- `git` CLI: branch creation, worktree management
- Existing Step 5 git state: provides current branch name

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Only in `/dev-checkpoint`, not `/dev-plan` | If done in `/dev-plan`, the subsequent `/dev-checkpoint` would fail because PRD files were moved | Adding to both skills with state tracking |
| Use `mv` instead of `cp` + `rm` | Atomic operation, simpler, fewer commands | Copy then delete (more steps, same result) |
| `git worktree add -b` (combined) | Creates branch + worktree in one command | Separate `git branch` + `git worktree add` |
| Detect first-time via `git branch --list` | Simple check, no extra state files needed | Backup file marker, metadata in checkpoint |

### Constraints

- **Reuse**: Step 5 git state (current branch), Step 1 feature name
- **Patterns to follow**: STOP gate before destructive action, `allowed-tools` for permissions
- **Avoid**: Absolute paths with usernames in output messages — use relative paths (`../<project>-<feature>`)

---

## Architecture Decision

**Approach**: Add a single new Step 9.5 to `dev-checkpoint/SKILL.md` that runs after the summary (Step 9), only on first-ever checkpoint when on main/master.

The step checks conditions, asks for confirmation, then executes 3 commands:
1. `git worktree add -b feature/<name> ../<project>-<name>` — create branch + worktree
2. `mkdir -p ../<project>-<name>/.dev && mv .dev/<name> ../<project>-<name>/.dev/` — move PRD files
3. `git -C ../<project>-<name> add .dev && git -C ../<project>-<name> commit -m "Add PRD for <name>"` — commit in worktree

After execution, clearly tell the user:
- The PRD files have been **moved** to the worktree (they no longer exist in the current directory)
- They should **end this session** and start a new one in the worktree directory
- Provide the exact path and suggest: `cd ../<project>-<name>` then `claude`

---

## Implementation Order

### Phase 1: Add Worktree Setup Step to dev-checkpoint
**Goal**: Add the optional worktree setup flow as Step 9.5 in `dev-checkpoint/SKILL.md`

1. ✅ Update `allowed-tools` frontmatter to add `Bash(git worktree:*)` and `Bash(git add:*)` and `Bash(git commit:*)`
2. ✅ Add new "Step 9.5: Optional Worktree Setup" section after Step 9 with:
   - **Conditions**: git repo AND on `main`/`master` AND `git branch --list feature/<feature-name>` returns empty
   - **STOP gate**: Ask user if they want to create a worktree-based workflow, explain what will happen (files will be moved, session must end)
   - **If declined**: Skill ends normally
   - **If accepted**: Execute the 3-command flow
   - **Post-execution message**: Clearly state files were moved, session should end, and where to continue

**Verification**:
- [x] YAML frontmatter parses correctly
- [x] Step only appears on first checkpoint (branch doesn't exist yet)
- [x] Step is skipped when not on main/master
- [x] Step is skipped when not a git repo
- [x] STOP gate waits for user confirmation
- [x] Run: `claude --plugin-dir ./plugins/dev-workflow` and test `/dev-checkpoint`

⏸️ **GATE**: Phase complete. Continue or `/dev-checkpoint`.

---

## File Changes Summary

### New Files

_None_

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` | Add `Bash(git worktree:*) Bash(git add:*) Bash(git commit:*)` to `allowed-tools` frontmatter. Add Step 9.5 section after Step 9 with conditional worktree setup flow. |

---

## Reference Files

- `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md`: Target file, contains Steps 1-9
- `plugins/dev-workflow/skills/dev-checkpoint/references/checkpoint-template.md`: Checkpoint format (already has `branch` field)
- `plugins/dev-workflow/skills/dev-resume/SKILL.md`: Branch mismatch pattern to reference
