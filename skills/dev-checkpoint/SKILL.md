---
name: dev-checkpoint
description: Save progress and generate continuation prompt for next session
disable-model-invocation: true
user-invocable: true
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

Create a continuation prompt following the format in `checkpoint-template.md`.

### Step 6: Save Checkpoint

Write the continuation prompt to `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md`. Create the file if it doesn't exist, or overwrite it completely if it does.

### Step 7: Summary

Tell me:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- What the next steps are
- Confirm the checkpoint location
