---
name: dev-quiz
description: >-
  Critique a feature plan in `.dev/<feature>/` against a fixed rubric and emit
  a structured `<verdict>` block. Use after `/dev-plan` to stress-test a PRD
  before implementation.
argument-hint: "[feature]"
allowed-tools: Bash(bash:*) Bash(node:*) Bash(git rev-parse:*) Read
---

## Quiz the Plan

Critique the master plan and any sub-PRDs for a feature against the rubric in [references/quiz-rubric.md](references/quiz-rubric.md), then emit exactly one `<verdict>` block.

### REVIEW-ONLY MODE

This skill reads and critiques. It does NOT modify anything.

- Do NOT call `Write` or `Edit` on any file.
- Do NOT update PRD status markers, checkpoints, or session logs.
- Do NOT spawn implementation work, even if the plan looks ready.
- The only output is the verdict block (and any feedback inside it). Nothing else is persisted.

If the user asks for a fix, point them to `/dev-plan` (to revise the PRD) or to direct edits — but do not perform either yourself.

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

- If the script exits non-zero (no `.dev/` directory): emit a single `escalate` verdict (see Step 4) explaining there is no feature to quiz, and stop.
- If output is empty: emit a single `escalate` verdict explaining no matching feature was found, and stop.
- If one line: use as `$FEATURE_PATH`.
- If multiple lines: ask the user which feature to quiz.

Never use raw `$ARGUMENTS` directly in shell commands or paths.

Validate with the [validation script](scripts/validate.sh):

```bash
bash "$VALIDATE" feature-path "$FEATURE_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Apply the path safety rules from Step 0 (`$HOME`, copy from output). Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** and emit an `escalate` verdict.

Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

### Step 2: Read the PRD Inputs

Use `Read` to load:

1. `$FEATURE_DIR/00-master-plan.md` (required)
2. Every `$FEATURE_DIR/NN-sub-prd-*.md` file present (optional, may be zero)

If `00-master-plan.md` does not exist, emit a single `escalate` verdict explaining the feature has no master plan, and stop.

Do not read `checkpoint.md` or `session-log.md` — the quiz critiques the plan, not the implementation history.

### Step 3: Apply the Rubric

Load [references/quiz-rubric.md](references/quiz-rubric.md) and walk every criterion against the PRD content. The rubric defines seven criteria across two groups:

**Structural (does the plan have the right shape?)**

1. **Decision-tree resolved** — every technical decision has a chosen option and rationale.
2. **Acceptance criteria explicit per phase** — every phase has at least one mechanically checkable verification.
3. **Open questions enumerated** — unresolved questions are labeled, not buried in prose. An empty open-questions state is acceptable as long as it is stated.
4. **Scope boundaries clear** — out-of-scope items are explicit, not implied.

**Substantive (does the plan stand up to a critic?)**

5. **Load-bearing assumptions surfaced** — assumptions the plan depends on are stated explicitly and are falsifiable, not buried in prose.
6. **Failure modes considered** — every external dependency / boundary has at least one sentence on what happens on the unhappy path.
7. **Counterfactual sanity** — the plan acknowledges a meaningfully simpler alternative and either adopts it or explains why it is insufficient.

For each criterion, decide pass/fail and (on fail) record one or more concrete feedback items pointing at the exact PRD location (file + section/row). For substance criteria, behave like a sparring partner — surface specific assumptions, name specific failure modes, propose specific simpler alternatives. Vague pushback is a non-answer.

### Step 4: Emit the Verdict

Emit exactly **one** `<verdict>` block as the last thing in the response. Nothing after it.

The verdict format is fixed (and shared with the future `dev-judge` skill so a single parser handles both):

**Pass** — every criterion holds:

```
<verdict>pass</verdict>
```

**Revise** — at least one criterion fails. Include a `<feedback>` block listing each failure with the PRD location:

```
<verdict>revise</verdict>
<feedback>
- Decision X has no rationale (00-master-plan.md, "Technical Decisions" row 3)
- Phase 2 Verification has no mechanically checkable item
- Out-of-scope section is missing
</feedback>
```

**Escalate** — the plan cannot be quizzed (missing inputs, ambiguous arguments, etc.). Include a `<reason>` block:

```
<verdict>escalate</verdict>
<reason>Feature directory contains no 00-master-plan.md.</reason>
```

Rules:

- Exactly one `<verdict>` block per response.
- `<feedback>` is required when the verdict is `revise`, omitted otherwise.
- `<reason>` is required when the verdict is `escalate`, omitted otherwise.
- Inside feedback bullets, anchor each item to a file and section/row so a reader can find it without re-reading the whole plan.
- Do not output anything after the `<verdict>` (or its companion block) — downstream parsers may treat trailing prose as part of the feedback.

## PRIVACY RULES

If the PRD contains absolute paths with usernames, secrets/credentials, or external private repository references, surface that as a `revise` feedback item — but do not redact or rewrite the file yourself. This skill is REVIEW-ONLY.
