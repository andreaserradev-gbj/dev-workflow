---
name: dev-judge
description: >-
  Critique a completed phase against its acceptance criteria using the diff,
  latest checkpoint, and (when available) test output. Emit a single
  `<verdict>` block. Use after a phase is implemented as a second-opinion gate.
argument-hint: "[feature]"
allowed-tools: Bash(bash:*) Bash(node:*) Bash(git rev-parse:*) Bash(git diff:*) Bash(git log:*) Bash(git status:*) Read
---

## Judge the Phase

Decide pass / revise / escalate on the most recently completed (or in-progress) phase by comparing the diff and checkpoint evidence against the phase's acceptance criteria. Emit exactly one `<verdict>` block.

### REVIEW-ONLY MODE

This skill reads, diffs, and judges. It does NOT modify anything.

- Do NOT call `Write` or `Edit` on any file.
- Do NOT update PRD status markers, checkpoints, or session logs.
- Do NOT commit, push, or otherwise advance the work — even if the diff looks ready.
- The only output is the verdict block (and any companion `<feedback>` / `<reason>`). Nothing else is persisted.

If the user asks for a fix, point them at the next step in their workflow (re-implement the phase, or `/dev-checkpoint` to capture the gap) — but do not perform either yourself.

### Step 0: Discover Project Root

Run the [discovery script](scripts/discover.sh):

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within this skill's directory.

**Path safety** — shell state does not persist between tool calls, so you must provide full script paths on each call:
- **Use `$HOME`** instead of the literal home directory (e.g., `bash "$HOME/code/…/discover.sh"`, not `bash "/Users/name/…/discover.sh"`). This prevents username hallucination.
- **Copy values from tool output.** When reusing a value returned by a previous command (like `$PROJECT_ROOT`), copy it verbatim from that command's output. Never retype a path from memory.
- **Verify on first call**: if a script call fails with "No such file", the path is wrong — STOP and re-derive from the skill-loading context.
- **Never ignore a non-zero exit.** If any script in this skill fails, stop and report the error before continuing.

Store the output as `$PROJECT_ROOT`. If the command fails, inform the user and stop.

### Step 1: Locate the Feature

Run the [discovery script](scripts/discover.sh) to find features:

```bash
bash "$DISCOVER" features "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise.

- If the script exits non-zero (no `.dev/` directory): emit a single `escalate` verdict (see Step 5) explaining there is no feature to judge, and stop.
- If output is empty: emit a single `escalate` verdict explaining no matching feature was found, and stop.
- If one line: use as `$FEATURE_PATH`.
- If multiple lines: ask the user which feature to judge.

Never use raw `$ARGUMENTS` directly in shell commands or paths.

Validate with the [validation script](scripts/validate.sh):

```bash
bash "$VALIDATE" feature-path "$FEATURE_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** and emit an `escalate` verdict.

Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

### Step 2: Identify the Target Phase

Run the CLI to find the phase under review:

```bash
node "$CLI" feature-show --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory.

Parse the JSON output:

- If `currentPhase` is non-null and the feature `status` is `"gate"` → judge the **most recently completed** phase (the one immediately before `currentPhase`). The user just finished it and wants a verdict before advancing.
- If `currentPhase` is non-null and `status` is `"active"` → judge the in-progress phase.
- If the feature is `"complete"` → judge the final phase (last in the list).
- If `currentPhase` is null and there are no phases → emit `escalate` (nothing to judge).

Set `$PHASE_NUMBER` and `$PHASE_TITLE` from the result.

### Step 3: Gather Evidence

Read in parallel:

1. **PRD phase spec** — read `$FEATURE_DIR/00-master-plan.md` and the matching `$FEATURE_DIR/NN-sub-prd-*.md` (if any). Extract the section for `$PHASE_NUMBER` and its **Verification** block (this is the acceptance criteria the judge compares against).
2. **Checkpoint** — read `$FEATURE_DIR/checkpoint.md` if present. Skip if absent (judge the diff alone).
3. **Git state** — capture branch and uncommitted-changes flag:
   ```bash
   bash "$GIT_STATE" brief
   ```
   Where `$GIT_STATE` is the absolute path to `scripts/git-state.sh` within this skill's directory.
4. **Diff evidence** — call `git diff` and `git log` directly via the allowed-tools to inspect what actually changed. Reasonable starting points:
   - `git log --oneline -20` — recent commits, to spot the phase boundary
   - `git diff HEAD~N` for the N commits attributable to the phase, OR
   - `git diff $(git merge-base HEAD main)` for the full branch diff if the phase is the only work on the branch
   - `git status --short` for uncommitted hunks
   Pick the narrowest diff that covers the phase. If unsure, prefer the wider diff and let the agent triage.

If `00-master-plan.md` is missing, emit a single `escalate` verdict and stop.

### Step 4: Spawn `phase-reviewer` Agent

Use the `Task` tool to launch the `phase-reviewer` subagent (registered in `.claude-plugin/plugin.json`). Pass the gathered evidence as a single bundle:

- **Phase spec** (master-plan section + sub-PRD section, including Verification block)
- **Checkpoint contents** (if present)
- **Diff** (the chosen `git diff` output) and recent commits
- **Branch + uncommitted flag** from `git-state.sh brief`

Instruct the agent to:

- Apply the rubric in its own definition (`agents/phase-reviewer.md`).
- Ground every claim in a file path or diff hunk — no rubber-stamp re-reads of the PRD.
- Emit exactly one `<verdict>` block as the **last thing** in its response.

The skill's only job after the agent returns is to surface the agent's verdict block verbatim. Do not paraphrase, summarize, or reorder the agent's output.

### Step 5: Emit the Verdict

Emit exactly **one** `<verdict>` block as the last thing in the response. Nothing after it.

The format is shared with `dev-quiz` so a single parser handles both:

**Pass** — every acceptance-criterion item has corresponding evidence:

```
<verdict>pass</verdict>
```

**Revise** — at least one criterion item is missing evidence, but the gap is concrete and fixable. Include a `<feedback>` block listing each gap with the file/criterion it ties to:

```
<verdict>revise</verdict>
<feedback>
- Acceptance criterion 2 (parser tests green) has no test fixtures in the diff — add at least one fixture covering the new code path.
- Step 3 ("scaffold dev-judge") is marked ✅ but `agents/phase-reviewer.md` is absent from the diff.
</feedback>
```

**Escalate** — ambiguity that cannot be resolved without human judgment (semantic ambiguity in the criterion, evidence of out-of-scope changes, evidence the diff broke unrelated code, irreversible action taken, missing inputs):

```
<verdict>escalate</verdict>
<reason>Diff modifies `tools/dev-workflow-core/src/scanner.ts` cache semantics, which is outside the phase's stated scope. Human triage needed.</reason>
```

Rules:

- Exactly one `<verdict>` block per response.
- `<feedback>` is required when the verdict is `revise`, omitted otherwise.
- `<reason>` is required when the verdict is `escalate`, omitted otherwise.
- Inside feedback bullets, anchor each item to a file/path and the specific acceptance criterion it ties to. Vague pushback ("tests look thin") is a non-answer.
- Do not output anything after the `<verdict>` (or its companion block) — downstream parsers (`parseVerdict` in `dev-workflow-core`) treat trailing prose as part of the feedback, and apply last-match semantics.

## PRIVACY RULES

If the diff or checkpoint contains absolute paths with usernames, secrets/credentials, or external private repository references, surface that as a `revise` feedback item — but do not redact or rewrite the file yourself. This skill is REVIEW-ONLY.
