---
description: Save progress and generate continuation prompt for next session
argument-hint: <feature name>
version: 2
output: $PROJECT_ROOT/.dev/<feature-name>/checkpoint.md
reads: $PROJECT_ROOT/.dev/<feature-name>/*.md, git state
---

## Checkpoint Current Session

Review the current session and create a continuation prompt for the next session.

### Agents

This command uses a specialized agent for progress analysis:

- **checkpoint-analyzer** (Haiku, orange) — Scans PRD files and extracts progress, decisions, and blockers

Agent definition is in `plugins/dev-workflow/agents/`.

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

### Step 2: Analyze Session with Agent

Launch the **checkpoint-analyzer agent** to scan PRD files and the current session:

```
"Analyze the PRD files in $PROJECT_ROOT/.dev/<feature-name>/ and the current session.
Find: completed items (⬜ → ✅), pending items, decisions made, blockers encountered.
Determine current phase and next step."
```

Use `subagent_type=checkpoint-analyzer` and `model=haiku`.

### Step 3: Review Agent Findings

After the agent returns:

1. **Verify accuracy** — Check that completed/pending items match what happened
2. **Add missing context** — Include any decisions or blockers the agent missed

### Step 4: Update PRD Status Markers (REQUIRED)

**This step is REQUIRED. Do not skip it.**

Based on the agent's findings, update PRD files:

#### 4a. List all PRD files in the feature directory:

```bash
find "$PROJECT_ROOT/.dev/<feature-name>" -name "*.md" -type f
```

#### 4b. For each PRD file with updates needed (from agent analysis):

1. **Read the file**
2. **Update status markers**:
   - Change `⬜` to `✅` for completed items identified by the agent
   - Keep `⬜` for pending items
   - Update any "Status" fields (e.g., "In Progress", "Complete")
3. **Edit the file** to save changes

#### 4c. Track your updates:

Keep a record of:
- Which files were updated
- What specific markers were changed (e.g., "Changed ⬜ to ✅ for 'Set up database schema'")

This record will be reported in Step 8.

**If no updates are needed** (nothing was completed), explicitly state: "No PRD updates needed - no items were completed this session."

### Step 5: Capture Git State

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

### Step 6: Confirm Session Context

Present the agent's findings (decisions, blockers, notes) and ask: "I captured these from our session—correct me if I missed anything or got something wrong."

If a category is empty, omit it.

**STOP. Do not proceed to Step 7 until the user confirms these findings are correct or provides corrections. Wait for explicit confirmation.**

### Step 7: Generate Continuation Prompt

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

### Step 8: Save Checkpoint

Write the continuation prompt to `$PROJECT_ROOT/.dev/<feature-name>/checkpoint.md`. Create the file if it doesn't exist, or overwrite it completely if it does.

### Step 9: Summary

Tell me:
- Which feature was checkpointed
- **PRD updates made** (list each file and what was changed, or state "No updates needed")
- What the next steps are
- Confirm the checkpoint location
