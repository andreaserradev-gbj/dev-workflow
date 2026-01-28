# Improve `/checkpoint` and `/resume` with GSD Patterns - Master Plan

**Status**: Complete
**Created**: 2026-01-28
**Last Updated**: 2026-01-28

---

## Executive Summary

The `/checkpoint` and `/resume` commands are the two simplest commands in the 3-command ecosystem (`/create-prd`, `/checkpoint`, `/resume`). They work but lose important session context: decisions made, blockers encountered, git state, and concrete next actions. The `get-shit-done` (GSD) project solves these problems with patterns like structured `.continue-here.md` checkpoints, semantic XML tags, git state capture, goal-backward verification, and deviation rules.

This PRD applies 7 targeted improvements cherry-picked from GSD to make `/checkpoint` capture richer context and `/resume` verify that context before acting. Both commands stay lean. Old checkpoints remain compatible.

**Reference**: get-shit-done (GSD project — source of patterns)

---

## Research Findings

### Codebase Patterns
- **3-command ecosystem**: `/create-prd` writes PRDs to `.dev/<feature-name>/`, `/checkpoint` reads PRDs and writes `checkpoint.md`, `/resume` reads `checkpoint.md` and PRDs — found in `create-prd.md` lines 8-11, 41-49
- **Status marker contract**: `⬜`/`✅` markers, `⏸️ **GATE**` pause points — found in `create-prd.md` lines 300-310
- **Checkpoint template**: 5-Question table, Current Progress, Next Steps, Key Files, Known Issues — found in `checkpoint.md` lines 37-84
- **Resume flow**: Find checkpoint → load → follow 8 sub-steps → present summary — found in `resume.md` lines 7-42

### Dependencies
- Claude Code custom commands: Only `description` is recognized in YAML frontmatter; extra fields are read as prompt content
- `.dev/<feature-name>/` directory structure shared across all 3 commands

### Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Additive changes only | Preserve backward compat with existing checkpoints | Full rewrite (rejected: breaks existing checkpoints) |
| Semantic XML wrapping | Claude parses XML tags more reliably than markdown headers for context | Keep pure markdown (rejected: less machine-parseable) |
| YAML frontmatter for version | Enables graceful degradation in `/resume` via "if field exists" guards | Inline version comment (rejected: harder to parse) |
| 3 structured prompts vs 1 catch-all | GSD's `.continue-here.md` proves structured capture yields better context | Keep single "Any notes?" question (rejected: loses decisions/blockers) |
| Deviation rules in `/resume` | GSD shows explicit escalation paths prevent silent failures | No deviation guidance (rejected: Claude improvises unpredictably) |

---

## Architecture Decision

**Approach**: Surgical insertion of new steps and template sections into existing commands.

Each command keeps its current structure. New steps are inserted between existing steps (e.g., "Step 2.5"). The checkpoint template gains YAML frontmatter, semantic XML wrappers, and two new sections (Decisions, Blockers). `/resume` gains a verification step and deviation rules. `/create-prd`'s contract table gets 3 new rows.

No new files are created beyond the modified commands. No separate workflow or template files.

---

## Implementation Order

### Phase 1: Enhance `/checkpoint`
**Goal**: Capture git state, decisions, blockers, and wrap template in semantic XML.

1. ✅ **Add extended frontmatter** to `checkpoint.md`
   - File: `claude/.claude/commands/dev-checkpoint.md`
   - Add `version: 2`, `output: .dev/<feature-name>/checkpoint.md`, `reads: .dev/<feature-name>/*.md, git state` to the YAML frontmatter block
   - These serve as structured documentation since Claude Code only parses `description`

2. ✅ **Add Step 2.5: Capture Git State**
   - File: `claude/.claude/commands/dev-checkpoint.md`
   - Insert new step between Step 2 (Update PRD Status Markers) and Step 3
   - Content:
     ```
     ### Step 2.5: Capture Git State

     Run and record:
     - Current branch name (`git branch --show-current`)
     - Whether there are uncommitted changes (`git status --short | head -5`)
     - Last commit summary (`git log --oneline -1`)

     Include this as a YAML-style header at the top of the checkpoint (see template).
     ```

3. ✅ **Replace Step 3 with structured context capture**
   - File: `claude/.claude/commands/dev-checkpoint.md`
   - Replace the current "Ask for Custom Notes" step with 3 focused prompts:
     ```
     ### Step 3: Capture Session Context

     Gather context through up to 3 focused prompts. Skip any that have obvious answers from the conversation.

     1. **Decisions**: "Were there any design decisions made this session? (e.g., chose library X over Y, decided on approach A)"
        - If the conversation already contains clear decisions, pre-fill and ask for confirmation.
     2. **Blockers/Gotchas**: "Any blockers, dead ends, or things the next session should avoid? (skip if none)"
     3. **Custom notes**: "Anything else to include? (skip if nothing)"
     ```

4. ✅ **Update checkpoint template with YAML header, XML tags, and new sections**
   - File: `claude/.claude/commands/dev-checkpoint.md`
   - Add YAML frontmatter block at the top of the template:
     ```
     ---
     branch: [branch-name]
     last_commit: [short hash] [message]
     uncommitted_changes: [yes/no]
     checkpointed: [YYYY-MM-DD HH:MM]
     ---
     ```
   - Wrap existing sections in semantic XML tags: `<context>`, `<current_state>`, `<next_action>`, `<key_files>`, `<notes>`
   - Add two new sections after "Next Steps":
     ```
     <decisions>
     ## Decisions Made
     - [Decision]: [Rationale]
     </decisions>

     <blockers>
     ## Blockers / Gotchas
     - [Issue]: [Status or workaround]
     </blockers>
     ```
   - Only include Decisions/Blockers sections if content was captured in Step 3. Add "(Omit if empty)" guidance.

**Verification**: Read the updated `checkpoint.md` command file. Confirm it has: extended frontmatter, git state step, 3-prompt capture step, and an updated template with YAML header + XML tags + Decisions/Blockers sections.

⏸️ **GATE**: Phase complete. Continue or `/checkpoint`.

---

### Phase 2: Enhance `/resume`
**Goal**: Verify checkpoint validity, present focused summary with concrete first action, handle drift.

1. ✅ **Add extended frontmatter** to `resume.md`
   - File: `claude/.claude/commands/dev-resume.md`
   - Add `version: 2`, `reads: .dev/<feature-name>/checkpoint.md, .dev/<feature-name>/*.md` to the YAML frontmatter block

2. ✅ **Add Step 2.5: Verify Checkpoint Context**
   - File: `claude/.claude/commands/dev-resume.md`
   - Insert new step between Step 2 (Load Checkpoint) and Step 3:
     ```
     ### Step 2.5: Verify Checkpoint Context

     Before acting on the checkpoint, perform a quick sanity check:

     1. **Branch match**: If the checkpoint has a `branch:` header, compare it to the current branch. If they differ, warn: "Checkpoint was on branch `X`, but you're on `Y`. Switch branches or continue?"
     2. **Staleness**: If the checkpoint has a `checkpointed:` timestamp older than 7 days, note: "This checkpoint is [N] days old. Some context may be stale."
     3. **Uncommitted changes drift**: If the checkpoint has `uncommitted_changes: yes`, check current `git status --short`. If the tree is now clean, note that previously uncommitted work may have been committed or lost.

     Present all warnings at once. If none, continue silently.
     ```

3. ✅ **Replace Step 3 with focused summary format**
   - File: `claude/.claude/commands/dev-resume.md`
   - Replace the 8 sequential sub-steps with:
     ```
     ### Step 3: Build Context and Present Summary

     1. **Read the PRD files** listed at the top of the checkpoint
     2. **Scan all checkpoint sections** (5-Question table, progress, decisions, blockers, next steps, key files)
     3. **Present a focused summary**:

        **Resuming: [Feature Name]**
        - **Status**: [phase/step from 5-Question table]
        - **Last session**: [1-sentence summary of what was done]
        - **Decisions to remember**: [key decisions, or "None recorded"]
        - **Watch out for**: [blockers/gotchas, or "None recorded"]
        - **Start with**: [Concrete first task from Next Steps, e.g., "Create the AuthProvider component in src/auth/"]

     4. **Wait for my go-ahead** before starting any work.
     ```

4. ✅ **Add deviation rules section**
   - File: `claude/.claude/commands/dev-resume.md`
   - Add after Step 3:
     ```
     ### Handling Discrepancies

     When the checkpoint and actual codebase diverge:

     - **File content changed but exists**: Proceed. Note the drift in your summary.
     - **Key file missing or renamed**: STOP. Ask before continuing.
     - **New files added not in checkpoint**: Proceed. Mention them in summary.
     - **Branch mismatch**: Ask (handled in Step 2.5).
     - **PRD file missing**: STOP. Cannot resume without the PRD.
     ```

**Verification**: Read the updated `resume.md` command file. Confirm it has: extended frontmatter, verification step, focused summary with "Start with:" line, and deviation rules.

⏸️ **GATE**: Phase complete. Continue or `/checkpoint`.

---

### Phase 3: Update `/create-prd` contract
**Goal**: Document new checkpoint fields so future commands respect the contract.

1. ✅ **Add new rows to CHECKPOINT COMPATIBILITY table**
   - File: `claude/.claude/commands/dev-plan.md`
   - Add 3 rows to the table at lines 305-310:
     ```
     | YAML frontmatter | `branch`, `last_commit`, `uncommitted_changes`, `checkpointed` | `/resume` verifies environment |
     | Semantic XML tags | `<context>`, `<current_state>`, `<decisions>`, `<blockers>`, `<next_action>`, `<key_files>`, `<notes>` | `/resume` parses structured sections |
     | Decisions/Blockers | `## Decisions Made`, `## Blockers / Gotchas` sections | `/resume` surfaces in summary |
     ```

**Verification**: Read the CHECKPOINT COMPATIBILITY table in `create-prd.md`. Confirm it has 8 rows (5 original + 3 new).

⏸️ **GATE**: Phase complete. Continue or `/checkpoint`.

---

## File Changes Summary

### Modified Files

| File | Changes |
|------|---------|
| `claude/.claude/commands/checkpoint.md` | Extended frontmatter, git state step (2.5), structured 3-prompt capture (step 3), YAML header + XML tags + Decisions/Blockers in template |
| `claude/.claude/commands/resume.md` | Extended frontmatter, verification step (2.5), focused summary with "Start with:" (step 3), deviation rules section |
| `claude/.claude/commands/create-prd.md` | 3 new rows in CHECKPOINT COMPATIBILITY table |

---

## Reference Files

- `claude/.claude/commands/checkpoint.md`: Primary target (97 lines -> ~140 lines)
- `claude/.claude/commands/resume.md`: Secondary target (42 lines -> ~70 lines)
- `claude/.claude/commands/create-prd.md`: Contract table update only (line 305-310)
