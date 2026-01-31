---
description: Save progress and generate continuation prompt for next session
argument-hint: <feature name>
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

### Step 2: Update PRD Status Markers (REQUIRED)

**This step is REQUIRED. Do not skip it.**

#### 2a. List all PRD files in the feature directory:

```bash
find "$PROJECT_ROOT/.dev/<feature-name>" -name "*.md" -type f
```

#### 2b. For each PRD file found:

1. **Read the file**
2. **Identify completed items** — tasks/steps finished this session
3. **Update status markers**:
   - Change `⬜` to `✅` for completed items
   - Keep `⬜` for pending items
   - Update any "Status" fields (e.g., "In Progress", "Complete")
4. **Edit the file** to save changes

#### 2c. Track your updates:

Keep a record of:
- Which files were updated
- What specific markers were changed (e.g., "Changed ⬜ to ✅ for 'Set up database schema'")

This record will be reported in Step 7.

**If no updates are needed** (nothing was completed), explicitly state: "No PRD updates needed - no items were completed this session."

### Step 3: Capture Git State

If this is a git repository, capture the current state:

```bash
# Branch name
git branch --show-current

# Last commit (one-line summary)
git log --oneline -1

# Uncommitted changes
git status --short
```

Store these values for the checkpoint YAML frontmatter.

**If not a git repository**: Skip this step and omit `branch`, `last_commit`, and `uncommitted_changes` from the YAML frontmatter.

### Step 4: Capture Session Context

Infer the following from conversation context. Present your findings and ask: "I captured these from our session—correct me if I missed anything or got something wrong."

1. **Decisions made** — architectural choices, trade-offs, approaches selected
2. **Blockers/gotchas** — issues encountered, things to watch out for
3. **Notes** — anything else relevant for the next session

If a category is empty, omit it. Do not ask multiple rounds of questions.

### Step 5: Generate Continuation Prompt

**Template rules**:
- Always include `<context>`, `<current_state>`, `<next_action>`, and `<key_files>`.
- Omit `<decisions>`, `<blockers>`, and `<notes>` sections entirely if empty.
- If not a git repo, omit `branch`, `last_commit`, and `uncommitted_changes` from frontmatter.

**Privacy rules** (MUST follow):
- NEVER include absolute paths containing usernames (e.g., `/Users/username/...`)
- NEVER include secrets, API keys, tokens, or credentials
- Use relative paths from project root instead (e.g., `./src/`, `plugins/`)
- Use generic descriptions for external references

Create a continuation prompt following this format:

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

### Step 6: Save Checkpoint

Write the continuation prompt to `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md`. Create the file if it doesn't exist, or overwrite it completely if it does.

### Step 7: Summary

Tell me:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- What the next steps are
- Confirm the checkpoint location
