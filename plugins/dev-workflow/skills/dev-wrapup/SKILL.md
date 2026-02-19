---
name: dev-wrapup
description: >-
  Review the current session for learnings and self-improvement signals.
  Surfaces memory candidates and improvement opportunities
  for user-confirmed application.
allowed-tools: Bash(bash:*) Read Write
---

## Session Wrap-Up

Review the current session for learnings worth persisting and self-improvement signals.

### REVIEW-ONLY MODE

This skill analyzes and suggests. It does NOT apply changes without explicit user confirmation.

- Do NOT write to any file until the user confirms specific items
- Do NOT create new files unless the user approves
- Present all findings for review, then wait for confirmation before each application step

### Step 0: Discover Project Root

Run the [discovery script](../../scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within the plugin directory. Inline actual values — do not rely on shell variables persisting between calls.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

---

## Phase 1 — Remember It

Surface facts, preferences, conventions, and gotchas from this session that are worth persisting to project memory.

### Step 1: Analyze Session for Memory Candidates

Launch the **session-analyzer agent** in memory mode:

```
"Review the current session conversation in memory mode.
Find: corrections the user made, stated preferences, project conventions discovered,
gotchas or workarounds encountered.

Before reporting, read the project's CLAUDE.md at $PROJECT_ROOT/CLAUDE.md to avoid
surfacing items that are already documented.

If .claude/rules/ exists at $PROJECT_ROOT, read those files too."
```

Use `subagent_type=dev-workflow:session-analyzer` and `model=haiku`.

### Step 2: Present Memory Candidates

After the agent returns, present the findings table to the user:

> **Memory Candidates from this session:**
>
> | # | Finding | Category | Destination | Rationale |
> |---|---------|----------|-------------|-----------|
> | ... | ... | ... | ... | ... |
>
> **Which items would you like to apply?** Reply with the numbers (e.g., "1, 3"), "all", or "none" to skip.

If the agent found no candidates, state: "No memory candidates found. Moving to Phase 2." and skip to Phase 2.

**STOP. Wait for the user to select items before proceeding.**

### Step 3: Apply Confirmed Memory Items

For each confirmed item, apply based on its **Destination**:

**CLAUDE.md** items:
1. Read `$PROJECT_ROOT/CLAUDE.md`
2. Find the most appropriate section for the new content
3. Present the proposed edit to the user: "I'll add this under [section]: `[content]`"
4. Write the change after confirmation

**.claude/rules/\<topic\>.md** items:
1. Check if the target file exists at `$PROJECT_ROOT/.claude/rules/<topic>.md`
2. If it exists, read it and append the new rule
3. If it doesn't exist, create it with the new rule
4. Present the proposed content before writing

**CLAUDE.local.md** items:
1. Read `$PROJECT_ROOT/CLAUDE.local.md` (create if missing)
2. Append the new content
3. Present the proposed content before writing

After applying, confirm: "Applied [N] memory items."

⏸️ **GATE**: Phase 1 complete. Continue to Phase 2 or stop here?

---

## Phase 2 — Review & Apply

Identify friction, mistakes, skill gaps, and automation opportunities from this session.

### Step 4: Analyze Session for Self-Improvement Signals

Launch the **session-analyzer agent** in self-improvement mode:

```
"Review the current session conversation in self-improvement mode.
Find: friction points (repeated manual steps), mistakes that were corrected,
knowledge gaps the assistant had, and tasks that could be automated.

Focus on patterns that would improve future sessions, not one-off issues."
```

Use `subagent_type=dev-workflow:session-analyzer` and `model=haiku`.

### Step 5: Present Self-Improvement Signals

After the agent returns, present the findings table to the user:

> **Self-Improvement Signals from this session:**
>
> | # | Signal Type | Observation | Proposed Action |
> |---|-------------|-------------|-----------------|
> | ... | ... | ... | ... |
>
> **Which items would you like to act on?** Reply with the numbers (e.g., "1, 3"), "all", or "none" to skip.

If the agent found no signals, state: "No self-improvement signals found." and skip to the summary.

**STOP. Wait for the user to select items before proceeding.**

### Step 6: Apply Confirmed Improvements

For each confirmed item, apply based on its **Signal Type**:

**friction** items:
- Add a rule to `CLAUDE.md` or `.claude/rules/<topic>.md` to prevent the friction
- Present the proposed rule before writing

**mistake** items:
- Add a preventive rule to the appropriate memory file
- Present the proposed rule before writing

**skill-gap** items:
- Add a note to `CLAUDE.md` or `.claude/rules/<topic>.md` with the learned knowledge
- Present the proposed content before writing

**automation** items:
- Present the automation idea as a suggested next step (do not create scripts in this skill)
- Format: "Consider creating a script or skill for: [description]"

After applying, confirm: "Applied [N] improvement items. [M] automation suggestions noted for future work."

---

## Summary

Report what was accomplished:

> **Session wrap-up complete.**
>
> - **Memory items applied**: [N] items written to [list of files touched]
> - **Improvements applied**: [N] rules added, [M] automation ideas noted
> - **Files modified**: [list each file that was changed]
>
> _Run `/dev-checkpoint` if you haven't already saved your session progress._

## PRIVACY RULES

**NEVER include in memory files or rules:**
- Absolute paths with usernames — use relative paths from project root
- Secrets, API keys, tokens, credentials — use placeholders (`<API_KEY>`, `$ENV_VAR`)
- Personal information (names, emails) — use generic references
