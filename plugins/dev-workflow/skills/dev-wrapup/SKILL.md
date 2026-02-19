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

## Analyze Session

### Step 1: Read Existing Memory

Before analyzing, read these files to avoid surfacing items already documented:

1. `$PROJECT_ROOT/CLAUDE.md`
2. `$PROJECT_ROOT/.claude/rules/` — if it exists, read all files in the directory
3. `$PROJECT_ROOT/CLAUDE.local.md` — if it exists

### Step 2: Scan Conversation

Review the full conversation history for findings worth persisting or acting on. If the session was short or routine with nothing notable, state "Nothing to report from this session." and stop.

**What to scan for:**

1. **Corrections** — Places where the user corrected the assistant's approach, naming, or assumptions
2. **Stated preferences** — "Always do X", "Never do Y", "I prefer Z"
3. **Project conventions** — Patterns discovered during implementation (naming, file structure, API style)
4. **Gotchas** — Pitfalls or workarounds encountered
5. **Friction** — Repeated manual steps, things the user had to ask for explicitly
6. **Mistakes** — Errors the assistant made and corrected
7. **Skill gaps** — Knowledge the assistant lacked or got wrong
8. **Automation opportunities** — Repetitive patterns that could become scripts or skills

**Quality filters:**

- **Be selective** — Only surface items that would genuinely help in future sessions
- **Be specific** — "Use snake_case for database columns" is useful; "follow naming conventions" is not
- **Skip duplicates** — Do not surface items already in CLAUDE.md, rules, or auto memory (read in Step 1)
- **Skip session-specific context** — Do not record task details that won't generalize
- **Skip general knowledge** — Do not record standard language/library behavior that any experienced developer knows. Hitting a quirk, fixing it, and moving on is normal coding — not everything learned is worth persisting. Only record it if the quirk is non-obvious AND project-specific or likely to recur in this codebase.
- **Prefer confirmed patterns** — Patterns confirmed by the user or observed multiple times are stronger candidates

### Step 3: Classify and Route Findings

For each finding, assign a **type** and a **destination**.

**Finding types:**

| Type | Description |
|------|-------------|
| `convention` | Coding style, naming, architecture patterns discovered |
| `preference` | User workflow choices, stated preferences |
| `fact` | Project-specific knowledge worth remembering |
| `gotcha` | Pitfalls or workarounds encountered |
| `friction` | Repeated manual steps or slowdowns |
| `mistake` | Errors made and corrected |
| `skill-gap` | Knowledge the assistant lacked |
| `automation` | Repetitive patterns that could become scripts or skills |

**Destination routing:**

| Destination | When to Use |
|---|---|
| `CLAUDE.md` (update) | Finding corrects or improves an existing CLAUDE.md section (e.g., a missing flag in a documented command). Edit the existing entry — do not create a new one elsewhere. |
| `CLAUDE.md` (add) | New operational instruction (how to build, test, run, deploy) or major architectural decision not yet documented. Keep minimal. |
| `.claude/rules/<topic>.md` | Knowledge tied to specific files where forgetting it causes silent breakage. Use `paths:` frontmatter to scope. |
| `CLAUDE.local.md` | Personal/ephemeral context not shared with the team. |
| `auto memory` | Patterns, insights, and project facts that add useful context but are not prescriptive instructions. |

**Decision tree** (evaluate in order, stop at first match):
1. Does this correct or extend something already documented in CLAUDE.md or rules? → **update the existing entry**
2. Is this an operational instruction (how to run, test, build, deploy)? → `CLAUDE.md`
3. Is this tied to specific files and forgetting it risks silent breakage? → `.claude/rules/<topic>.md`
4. Is this personal/ephemeral? → `CLAUDE.local.md`
5. Is this a useful pattern or insight that adds context? → `auto memory`

### Step 4: Present Findings

If no findings, state: "Nothing to report from this session." and skip to the summary.

Present findings in two parts:

**Part A — Detailed Analysis**: For each finding, write a short paragraph explaining what happened, why it matters, and the proposed action. Number each finding.

> **Session Findings:**
>
> **1. [Title]** (`type` → `destination`)
> [2-3 sentence explanation of what happened, why it matters, and what to persist or do.]
>
> **2. [Title]** (`type` → `destination`)
> [2-3 sentence explanation...]

**Part B — Recap Table**: After the detailed analysis, present a summary table:

> | # | Type | Finding | Destination |
> |---|------|---------|-------------|
> | 1 | gotcha | [Short description] | CLAUDE.md (update) |
> | 2 | convention | [Short description] | .claude/rules/testing.md |
>
> **Which items would you like to apply?** Reply with the numbers (e.g., "1, 3"), "all", or "none" to skip.

**STOP. Wait for the user to select items before proceeding.**

### Step 5: Apply Confirmed Items

For each confirmed item, apply based on its **Destination**:

**CLAUDE.md (update)** items:
1. Read `$PROJECT_ROOT/CLAUDE.md`
2. Locate the existing section that needs correction
3. Present the proposed diff to the user: "I'll change `[old]` to `[new]` in [section]"
4. Write the change after confirmation

**CLAUDE.md (add)** items:
1. Read `$PROJECT_ROOT/CLAUDE.md`
2. Find the most appropriate existing section for the new content
3. Present the proposed edit to the user: "I'll add this under [section]: `[content]`"
4. Write the change after confirmation

**.claude/rules/\<topic\>.md** items:
1. Check if the target file exists at `$PROJECT_ROOT/.claude/rules/<topic>.md`
2. If it exists, read it and append the new rule
3. If it doesn't exist, create it with the new rule (include `paths:` frontmatter scoped to relevant files)
4. Present the proposed content before writing

**.claude/rules/ (update)** items:
1. Read the existing rule file
2. Present the proposed diff
3. Write the change after confirmation

**CLAUDE.local.md** items:
1. Read `$PROJECT_ROOT/CLAUDE.local.md` (create if missing)
2. Append the new content
3. Present the proposed content before writing

**auto memory** items:
1. Save the content to your auto memory
   - Use concise, specific phrasing (e.g., "Project uses pnpm, not npm")
   - For detailed items, specify a topic file name (e.g., "save to debugging topic")
   - Index entries in MEMORY.md should be brief pointers; details go in topic files
2. Confirm: "Saved to auto memory: [brief description]"

**automation** items:
- Present the automation idea as a suggested next step (do not create scripts in this skill)
- Format: "Consider creating a script or skill for: [description]"

After applying, confirm: "Applied [N] items. [M] automation suggestions noted for future work."

---

## Summary

Report what was accomplished:

> **Session wrap-up complete.**
>
> - **Items applied**: [N] items to [list destinations touched]
> - **Automation ideas**: [M] noted for future work (or "none")
> - **Files modified**: [list each file that was changed, or "none"]

## PRIVACY RULES

**NEVER include in memory files, rules, or auto memory:**
- Absolute paths with usernames — use relative paths from project root
- Secrets, API keys, tokens, credentials — use placeholders (`<API_KEY>`, `$ENV_VAR`)
- Personal information (names, emails) — use generic references
