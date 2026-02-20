---
name: dev-wrapup
description: >-
  Review the current session for learnings and self-improvement signals.
  Surfaces memory candidates and improvement opportunities
  for user-confirmed application.
allowed-tools: Bash(bash:*) Read Write Edit
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

### Step 1: Read Existing Documentation

Before analyzing, read these files to avoid surfacing items already documented:

1. `$PROJECT_ROOT/CLAUDE.md` (or equivalent project docs: `AGENTS.md`, `GEMINI.md`) — whichever exists, store its name as `$PROJECT_DOCS` for use in routing targets later
2. `$PROJECT_ROOT/.claude/rules/` (or equivalent scoped rules directory) — if it exists, read all files in the directory; store the path as `$SCOPED_RULES_DIR`
3. `$PROJECT_ROOT/CLAUDE.local.md` (or equivalent personal project docs) — if it exists, store its path as `$PERSONAL_PROJECT_DOCS`
4. `~/.claude/CLAUDE.md` (or equivalent user global docs) — if it exists, store its path as `$USER_GLOBAL_DOCS`

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

**Quality filters — apply strictly:**

- **Be selective** — Only surface items that would genuinely change behavior in future sessions. If the finding wouldn't alter how you approach a task, skip it.
- **Be specific** — "Use snake_case for database columns" beats "follow naming conventions"
- **Skip duplicates** — Do not surface items already in project docs, rules, user global, or auto memory (read in Step 1). PRD files (e.g., `.dev/`) count as existing documentation only if they are git-tracked (not gitignored). If the PRD directory is gitignored, findings documented there are transient and should still be routed to persistent project docs.
- **Skip session-specific context** — Do not record task details, in-progress state, or temporary debugging notes
- **Skip general knowledge** — Standard language/library/framework behavior that any experienced developer knows is not worth persisting. Only persist if the behavior is non-obvious AND project-specific or likely to recur in this codebase.
- **Prefer team-shared destinations** — When in doubt about where something belongs, default to project docs over personal memory. Most valuable findings are things the team should know.

### Step 3: Classify and Route Findings

For each finding, assign a **type** and a **destination**.

**Finding types:**

| Type | Description |
|------|-------------|
| `convention` | Coding style, naming, architecture patterns |
| `preference` | User workflow choices, stated preferences |
| `fact` | Project-specific knowledge |
| `gotcha` | Pitfalls or workarounds |
| `friction` | Repeated manual steps or slowdowns |
| `mistake` | Errors made and corrected |
| `skill-gap` | Knowledge the assistant lacked |
| `automation` | Repetitive patterns that could become scripts |

**Destinations:**

Every AI coding tool offers similar tiers of persistent documentation. This skill uses general concepts mapped to tool-specific paths:

| Destination | What belongs here | Claude Code | Codex | Gemini CLI |
|---|---|---|---|---|
| **Project docs (update)** | Corrections to existing team documentation | `CLAUDE.md` edit | `AGENTS.md` edit | `GEMINI.md` edit |
| **Project docs (add)** | New team knowledge: conventions, architecture, operations, gotchas | `CLAUDE.md` add | `AGENTS.md` add | `GEMINI.md` add |
| **Scoped rules** | Invariants tied to specific files; forgetting risks silent breakage | `.claude/rules/<topic>.md` | subdirectory `AGENTS.md` | subdirectory `GEMINI.md` |
| **User global** | Personal preferences that apply across ALL projects | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | `~/.gemini/GEMINI.md` |
| **Personal project** | Private, ephemeral, or machine-specific project context | `CLAUDE.local.md` | — | — |
| **Personal memory** | AI self-notes: non-instructional observations about user or project | auto memory | — | `save_memory` |

**Decision tree** — evaluate in order, stop at first match:

1. Does this correct or extend something already documented? → **Project docs (update)**
2. Would the team benefit from knowing this? (conventions, architecture decisions, build/test/deploy commands, project-wide gotchas, common mistakes in this codebase) → **Project docs (add)**
3. Is this tied to specific files where forgetting causes silent breakage? → **Scoped rules**
4. Is this a personal preference that applies across ALL projects? ("always use X", "never do Y" regardless of which project) → **User global**
5. Is this private or machine-specific context for this project? (local environment, personal test data, temporary workarounds) → **Personal project**
6. Is this a non-instructional observation that provides useful context? (debugging history, how the user works, codebase quirks that aren't actionable instructions) → **Personal memory**
7. None of the above → **skip it**. Not every finding needs to be persisted.

**Routing guard rails:**

- If you can phrase it as an instruction ("do X", "avoid Y", "use Z when W"), it is NOT personal memory — route to project docs, scoped rules, or config instead.
- If the finding would help a new team member onboard, it belongs in project docs.
- If more than half your findings route to personal memory, re-evaluate — you are likely under-using project docs.

**Self-check** — After routing all findings, review before presenting:

1. Count destinations. Does >50% go to personal memory? If yes, re-route: for each personal memory item, re-apply the "phrasable as instruction" test and the decision tree from step 1.
2. For each personal memory item, verify it truly fails all earlier decision tree steps (1–5). If it matches an earlier step, re-route it there.

**Routing examples:**

| Finding | Correct | Why |
|---|---|---|
| "Tests must run with `--no-cache` flag" | Project docs (add) | Operational instruction the team needs |
| "User prefers small, incremental commits" | User global | Cross-project personal preference |
| "Payment module silently swallows errors in catch blocks" | Scoped rules | File-tied gotcha; forgetting causes bugs |
| "User corrected: use `pnpm` not `npm`" | Project docs (update or add) | Team should know the package manager |
| "Flaky test in `auth.spec.ts` caused by timezone mismatch" | Personal memory | Debugging context, not an instruction |
| "Always run migrations before seeding" | Project docs (add) | Operational instruction, not a personal note |

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

> | # | Type | Finding | Destination | Target |
> |---|------|---------|-------------|--------|
> | 1 | gotcha | [Short description] | Project docs (update) | `$PROJECT_DOCS` |
> | 2 | convention | [Short description] | Scoped rules | `$SCOPED_RULES_DIR/naming.md` |
>
> **Which items would you like to apply?** Reply with the numbers (e.g., "1, 3"), "all", or "none" to skip.

**STOP. Wait for the user to select items before proceeding.**

### Step 5: Apply Confirmed Items

For each confirmed item, apply based on its **destination**:

**Project docs (update)** items:
1. Read `$PROJECT_DOCS`
2. Locate the existing section that needs correction
3. Present the proposed diff: "I'll change `[old]` to `[new]` in [section]"
4. Apply after confirmation

**Project docs (add)** items:
1. Read `$PROJECT_DOCS`
2. Find the most appropriate existing section for the new content
3. Present the proposed addition: "I'll add this under [section]: `[content]`"
4. Apply after confirmation

**Scoped rules** items:
1. Check if `$SCOPED_RULES_DIR/<topic>.md` exists
2. If it exists, read it and present the proposed append
3. If it doesn't exist, present the new file content (include `paths:` frontmatter scoped to relevant files/directories)
4. Apply after confirmation

**Scoped rules (update)** items:
1. Read the existing rule file
2. Present the proposed diff
3. Apply after confirmation

**User global** items:
1. Read `$USER_GLOBAL_DOCS` (create if missing)
2. Find or create an appropriate section
3. Present the proposed addition — note that this affects ALL projects
4. Apply after confirmation

**Personal project** items:
1. Read `$PERSONAL_PROJECT_DOCS` (create if missing)
2. Present the proposed content
3. Apply after confirmation

**Personal memory** items:
1. Save the content to your auto memory
   - Use concise, specific phrasing (e.g., "Project uses pnpm, not npm")
   - For detailed items, specify a topic file name (e.g., "save to debugging topic")
   - Index entries in MEMORY.md should be brief pointers; details go in topic files
2. Confirm: "Saved to auto memory: [brief description]"

**Automation** items:
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

**NEVER include in any destination file:**
- Absolute paths with usernames — use relative paths from project root
- Secrets, API keys, tokens, credentials — use placeholders (`<API_KEY>`, `$ENV_VAR`)
- Personal information (names, emails) — use generic references
