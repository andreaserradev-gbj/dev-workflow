# Checkpoint Template

Use this format for the continuation prompt written to `checkpoint.md`:

```
---
branch: [branch name from Step 5]
last_commit: [last commit summary from Step 5]
uncommitted_changes: [true/false]
checkpointed: [ISO 8601 timestamp]
---

Read the following PRD files in order:

1. [path to master plan or main PRD]
2. [path to relevant sub-PRDs if applicable]

<context>
## Context

**Goal**: [Feature goal in one sentence]
**Current phase**: [Phase name] — [current step]
**Key completions**: [What's been done]
</context>

<current_state>
## Current Progress

- ✅ [Completed item 1]: [Brief description]
- ✅ [Completed item 2]: [Brief description]
- ⬜ [Next pending item]: Not Started/In Progress - [description]
- ⬜ [Following item]: Not Started
</current_state>

<next_action>
## Next Steps

[Current Step] ([component]):
- [Specific task 1]
- [Specific task 2]

[Subsequent steps with same format]
</next_action>

<key_files>
## Key Files

- [Role]: [full path]
- [Role]: [full path]
- [New file if any]: [full path]
</key_files>

<!-- Include each section below only if non-empty -->
<decisions>## Decisions
[Decisions from session]</decisions>

<blockers>## Blockers / Gotchas
[Blockers from session]</blockers>

<notes>## Notes
[Notes from session]</notes>

---

Please continue with [Next Steps summary — adapt to the current phase: research, design, or implementation], following the specifications in the PRD.
```
