---
description: Save progress and generate continuation prompt for next session
version: 2
output: $PROJECT_ROOT/.dev/<feature-name>/checkpoint.md
reads: $PROJECT_ROOT/.dev/<feature-name>/*.md, git state
---

## Checkpoint Current Session

Review the current session and create a continuation prompt for the next session.

### Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this command.

### Step 1: Identify the Active Feature

First, check if a `$PROJECT_ROOT/.dev/` directory exists. If it does not exist, ask me to specify the feature name and create the `$PROJECT_ROOT/.dev/<feature-name>/` directory before proceeding.

If `$PROJECT_ROOT/.dev/` exists, find all available features:

```bash
find "$PROJECT_ROOT/.dev" -maxdepth 1 -type d ! -name .dev
```

**If an argument was provided** (`$ARGUMENTS`):
- Filter the feature list to those whose name contains the argument (case-insensitive match)
- If exactly one match: use that feature
- If multiple matches: ask which of the matching features to checkpoint
- If no matches: inform me that no features match "$ARGUMENTS" and list all available features

**If no argument was provided**:
- If multiple features exist: ask me "Which feature would you like to checkpoint?" and list the available features
- If only one feature exists: use that one
- If no features exist: ask me to specify the feature name

The checkpoint will be saved to `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md`.

### Step 2: Update PRD Status Markers

For each relevant task file in the feature directory:
- Change ⬜ to ✅ for completed items
- Keep ⬜ for pending items
- Update any "Status" fields (e.g., "In Progress", "Complete")

### Step 3: Capture Git State

Capture the current git state for checkpoint context:

```bash
# Branch name
git branch --show-current

# Last commit (one-line summary)
git log --oneline -1

# Uncommitted changes (first 5 lines)
git status --short | head -5
```

Store these values — they will be included in the checkpoint YAML frontmatter.

### Step 4: Capture Session Context

Ask me the following prompts one at a time. Pre-fill answers from conversation context when obvious. Skip any prompt where the answer is clearly "none."

1. **Decisions made this session**: "What key decisions were made? (I noticed: [pre-filled from conversation if obvious])"
2. **Blockers/gotchas**: "Any blockers or gotchas to flag for next session? (skip if none)"
3. **Custom notes**: "Any other notes or instructions? (skip if nothing)"

### Step 5: Generate Continuation Prompt

Create a continuation prompt following this exact format:

```
---
branch: [branch name from Step 3]
last_commit: [last commit summary from Step 3]
uncommitted_changes: [true/false]
checkpointed: [ISO 8601 timestamp]
---

Read the following PRD files in order:

1. [path to master plan or main PRD]
2. [path to relevant sub-PRDs if applicable]

<context>
## Quick Context (5-Question Check)

| Question | Answer |
|----------|--------|
| Where am I? | [Current phase/step] |
| Where am I going? | [Next phases/steps] |
| What's the goal? | [Feature goal in one sentence] |
| What have I learned? | See Research Findings in master plan |
| What have I done? | [Key completions] |
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

[Current Step] Implementation ([component] side):
- [Specific task 1]
- [Specific task 2]
- [Specific task 3]

[Next Step] Implementation ([component] side):
- [Specific task 1]
- [Specific task 2]
</next_action>

<key_files>
## Key Files

- [Role]: [full path]
- [Role]: [full path]
- [New file if any]: [full path]
</key_files>

<decisions>
## Decisions

[Decisions captured in Step 4, or omit this section if none]
</decisions>

<blockers>
## Blockers / Gotchas

[Blockers captured in Step 4, or omit this section if none]
</blockers>

<notes>
## Notes

[Custom notes from Step 4, or omit this section if none]
</notes>

---

Please continue with [Next Steps summary — adapt to the current phase: research, design, or implementation], following the specifications in the PRD.
```

**Template rules**:
- Omit `<decisions>`, `<blockers>`, and `<notes>` sections entirely if they are empty.
- Always include `<context>`, `<current_state>`, `<next_action>`, and `<key_files>`.

### Step 6: Save Checkpoint

Update the checkpoint file at `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md` with the new continuation prompt. If the file already exists, overwrite it completely with the new content. Use the Edit tool to replace the entire file content.

### Step 7: Summary

Tell me:
- Which feature was checkpointed
- Which PRD files were updated
- What the next steps are
- Confirm the checkpoint location
