---
name: dev-plan
description: >-
  Plan a new feature with structured PRD documentation.
  Researches codebase patterns, designs implementation phases,
  and writes PRD files to .dev/.
argument-hint: <feature description>
allowed-tools: Bash(git rev-parse:*) Bash(printf:*) Bash(test:*) Bash(grep:*) Bash(tr:*) Bash(sed:*) Read
---

## Step 0: Determine Project Root

Before proceeding, determine the project root directory:

1. If this is a git repository, use: `git rev-parse --show-toplevel`
2. If not a git repository, use the initial working directory from the session context (shown in the environment info at session start)

Store this as `$PROJECT_ROOT` and use it for all `.dev/` path references throughout this skill.

## PRIMARY DIRECTIVE

The sole deliverable is PRD files written to `$PROJECT_ROOT/.dev/$FEATURE_NAME/`.
Produce documentation, not code. Every session must end with files on disk.

This is part of a 3-skill system (`/dev-plan` → `/dev-checkpoint` → `/dev-resume`). The other skills parse PRD files using status markers (`⬜`/`✅`), phase gates, file changes summary, and sub-PRD links.

**Plan mode**: If active, write a PRD summary to the plan file, call `ExitPlanMode`, then write full PRD files after approval.

## AGENTS

This skill uses specialized agents for research and planning:

- **prd-researcher** (cyan) — Researches codebase for patterns, dependencies, and reference implementations
- **prd-planner** (green) — Designs implementation phases and file changes

Agent definitions are in `plugins/dev-workflow/agents/`.

## PHASE 1: UNDERSTAND

$ARGUMENTS

The 3 key questions for this phase:
1. **What feature do you want to build?** (Brief description)
2. **What problem does it solve?** (User need or business requirement)
3. **Is there a reference implementation?** (Existing code, similar feature)

### Path A — Arguments were provided above

If `$ARGUMENTS` above is non-empty (the user provided a feature description):
1. Extrapolate answers to all 3 questions from the provided text.
2. Present a 2-3 sentence summary of your understanding.
3. **Proceed directly to Phase 2.** Do not ask for confirmation.

### Path B — No arguments provided

If `$ARGUMENTS` above is empty (the user ran `/dev-plan` with no arguments):
1. Ask the 3 questions above.
2. **STOP. Do not output anything else. Do not proceed until the user responds with their answers.**
3. After receiving answers, summarize your understanding in 2-3 sentences.
4. Ask: "Does this capture your intent? Confirm and I'll start researching."
5. Do NOT move to Phase 2 until the user explicitly confirms.

> **Guardrail**: Once confirmed (Path B) or summarized (Path A), move to research. Don't linger here.

### Step 1.5: Derive and Validate `$FEATURE_NAME`

Before creating any directories or files, set a safe feature slug in `$FEATURE_NAME`.

Example command sequence:

```bash
# Set from the confirmed feature intent (short human-readable candidate name)
CANDIDATE_FEATURE_NAME="<feature-intent-slug-source>"
FEATURE_NAME="$(printf '%s' "$CANDIDATE_FEATURE_NAME" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
printf '%s' "$FEATURE_NAME" | grep -Eq '^[a-z0-9][a-z0-9-]*$' \
  || { echo "Invalid feature name slug: $FEATURE_NAME"; exit 1; }
```

**If the above validation exits non-zero, STOP immediately. Report the validation error to the user and do not proceed to any subsequent step.**

Rules:
- Never use raw `$ARGUMENTS` directly in file paths.
- Use `$FEATURE_NAME` for all `.dev/` path references.

## PHASE 2: RESEARCH

Launch **2-3 prd-researcher agents in parallel** using the Task tool with different focuses:

```
Agent 1: "Find similar implementations and patterns to reuse for [feature]. Include file:line references."
Agent 2: "Identify architecture constraints, dependencies, and integration points for [feature]."
Agent 3: "List all files that will need modification for [feature] and what changes are needed."
```

Use `subagent_type=dev-workflow:prd-researcher` and `model=sonnet` for each agent.

### After Agents Return

1. **Synthesize findings** — Combine agent outputs into a unified Research Summary
2. **Present summary** using this format:
   - **Patterns to reuse** — existing code/architecture to leverage (with `file:line` refs)
   - **Files to modify** — list of paths with 1-line descriptions
   - **Key decisions** — 2-3 architectural choices needing confirmation
   - **Open questions** — anything unclear (if any)

Keep it to ~10-15 lines.

**STOP. Do not proceed to Phase 3 until the user confirms the research findings or provides corrections.**

> **Guardrail**: Research serves the PRD. Move to writing after one research round. If deeper investigation is requested, do one more round — then write.

## PHASE 3: WRITE THE PRD

Launch **1 prd-planner agent** to design the implementation structure:

```
"Design implementation phases for [feature].
Research findings: [summarize key patterns and files from Phase 2].
Determine if this needs sub-PRDs (complex) or a single PRD (simple)."
```

Use `subagent_type=dev-workflow:prd-planner`.

### After Agent Returns

1. **Review agent output** — Verify phases are logical and complete
2. **Propose architecture approach** — Present the recommended structure to the user

**STOP. Do not create any files until the user confirms the architecture approach or requests adjustments.**

3. **Create files** under `$PROJECT_ROOT/.dev/$FEATURE_NAME/`:
   - Always create `00-master-plan.md` — use the Master Plan template in [prd-templates.md](references/prd-templates.md)
   - For complex features, create `01-sub-prd-[name].md` etc. — use the Sub-PRD template in [prd-templates.md](references/prd-templates.md)
   - Incorporate research findings (Phase 2) and implementation plan (agent output) into the PRD
4. **State what was created** — list every file path written.
5. **Suggest running `/dev-checkpoint`** to save a continuation prompt.

> **Guardrail**: Files MUST be created. If this phase is reached without writing, stop everything else and write the PRD.

## RULES

- One round of research, then write — do NOT research endlessly
- Fold research findings into the master plan's "Research Findings" section (no separate `findings.md`)

## PRIVACY RULES

**NEVER include in PRD files** — use safe alternatives:
- Absolute paths with usernames → use relative paths from project root
- Secrets, API keys, tokens, credentials → use placeholders (`<API_KEY>`, `$ENV_VAR`)
- Personal information (names, emails) → use generic references
