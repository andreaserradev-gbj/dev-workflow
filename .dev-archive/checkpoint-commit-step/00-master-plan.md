# Checkpoint Commit Step - Master Plan

**Status**: Complete
**Created**: 2026-02-15
**Last Updated**: 2026-02-15

---

## Executive Summary

Add an optional git commit step to the `/dev-checkpoint` skill. After checkpoint.md is generated and the optional worktree setup completes, the skill asks the user if they want to commit all current code changes with a descriptive message derived from the checkpoint context.

This reduces friction by letting users checkpoint and commit in one flow instead of manually running git commands after every checkpoint.

**Reference**: `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` — Step 9.5 (worktree setup) is the pattern to follow.

---

## Research Findings

### Codebase Patterns
- **Step 9.5 conditional pattern** (`SKILL.md:120-183`): Skip conditions + STOP gate + accept/decline branching — reuse this exact structure
- **Git state capture** (`SKILL.md:85-90`): Branch, last commit, uncommitted changes already captured in Step 5 — reuse to determine if there are changes to commit
- **allowed-tools frontmatter** (`SKILL.md:8`): Already includes `Bash(git add:*)` and `Bash(git commit:*)` — no frontmatter changes needed

### Dependencies
- git CLI (already a dependency of the skill)

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Place after Step 9.5 (as final step) | Avoids committing dev files that worktree already handled; commit only captures user's code changes | Before worktree (would duplicate dev files in history), before checkpoint.md (would miss checkpoint file) |
| Use `git status --porcelain` for skip check | Reliable, machine-parseable output for detecting uncommitted changes | Reuse Step 5's `git status --short` (same data but already captured — however we need a fresh check after worktree may have moved files) |
| Derive commit message from checkpoint context | The checkpoint summary already describes what was done — natural commit message source | Ask user to type a message (more friction), use feature name only (less descriptive) |

### Constraints

- **Reuse**: Step 9.5's conditional skip + STOP gate + accept/decline pattern
- **Patterns to follow**: "Skip this step entirely if ANY of these are true" + bullet list of conditions
- **Avoid**: Auto-committing without user confirmation; committing before worktree setup

---

## Architecture Decision

**Approach**: Add a new Step 10 at the end of the skill, following Step 9.5's exact structure.

The step checks for uncommitted changes, proposes a commit message derived from the checkpoint context (feature name + summary of what was done), presents a STOP gate for user approval, then stages tracked edits (`git add -u`) plus any user-approved new files and runs `git commit -m "<message>"` if accepted.

Placement after Step 9.5 ensures:
1. Dev files are already handled by worktree (if applicable)
2. The commit only captures the user's actual code changes
3. The checkpoint.md is already written (included in commit if not moved to worktree)

---

## Implementation Order

### Phase 1: Add Optional Commit Step
**Goal**: Add Step 10 to SKILL.md that offers to commit changes after checkpoint is saved

1. ✅ Add Step 10 after Step 9.5 (line 184) with:
   - Skip conditions: not a git repo, or `git status --porcelain` is empty
   - Fresh `git status --porcelain` check (since worktree step may have moved files)
   - Generate commit message from feature name and checkpoint summary
   - STOP gate presenting: proposed commit message + summary of what will be committed
   - "If user accepts": run `git add -u`, stage any user-approved new files explicitly, then `git commit -m "<message>"`; confirm with `git log -1 --oneline`
   - "If user declines": end normally

**Verification**:
- [ ] Step skips when not a git repo
- [ ] Step skips when no uncommitted changes exist
- [ ] STOP gate shows proposed commit message and waits for confirmation
- [ ] Commit executes correctly when accepted
- [ ] Skill ends normally when declined
- [ ] Run: `claude --plugin-dir ./plugins/dev-workflow` and test `/dev-checkpoint` in a scratch repo

---

## File Changes Summary

### New Files

None

### Modified Files

| File | Changes |
|------|---------|
| `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md` | Add Step 10 (optional git commit) after line 183 |

---

## Reference Files

- `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md:120-183`: Step 9.5 pattern to replicate
- `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md:85-90`: Git state capture in Step 5
- `plugins/dev-workflow/skills/dev-checkpoint/SKILL.md:8`: allowed-tools frontmatter (already has git add/commit)
