# Quiz Rubric

Seven criteria, in two groups:

- **Structural (1–4)** — does the plan have the right shape? These are completeness checks: a plan that fails one of these is missing a section a reviewer would expect to find.
- **Substantive (5–7)** — does the plan stand up to a critic? These ask whether the plan addresses the questions a real reviewer would actually push on.

Each criterion has a concrete falsifiable check, a fail condition, and an example feedback line to emit on fail.

A plan **passes** only if every criterion passes. Any single failure produces a `revise` verdict with one or more feedback items per failed criterion.

The rubric is deliberately strict. The structural group catches plans that will stall because something is missing; the substantive group catches plans that will stall because something is wrong. The skill is the second opinion the human reviewer would give if they had unlimited patience.

When applying the substance criteria, behave like a sparring partner, not a checklist: surface assumptions the plan leans on without saying so, name failure modes the plan glosses, and propose a meaningfully simpler version when the plan jumps to a sophisticated design without justifying it. Feedback bullets should make a falsifiable claim, not just ask a vague question.

---

## 1. Decision-Tree Resolved

**What to look for**

- A "Technical Decisions" table (or equivalent prose section) in `00-master-plan.md`.
- Every row names the chosen option **and** records a rationale.
- "Alternatives Considered" entries are present where relevant, with a brief reason for rejection.

**Fail conditions**

- A decision row has the chosen option blank, marked `TBD`, marked `???`, or phrased as "we'll figure out later" / "TBC" / "decide during implementation".
- A rationale is missing (only the choice is stated, no reasoning).
- A decision is mentioned in prose but not captured in the table.

**Example feedback line on fail**

```
- "Verdict transport" decision has no rationale (00-master-plan.md, "Technical Decisions" row 1)
- Worktree-vs-branch decision is discussed in prose but missing from the decision table (00-master-plan.md, "Architecture Decision" section)
```

---

## 2. Acceptance Criteria Explicit Per Phase

**What to look for**

- Every Implementation Phase in `00-master-plan.md` has a `Verification` (or equivalently named) section.
- Each phase's verification list contains at least one item an external reviewer can mechanically run: a shell command, a file existence check, a typecheck/test invocation, or an observable behavior with a concrete trigger.
- Sub-PRDs, when present, mirror this discipline within their own scope.

**Fail conditions**

- A phase has no verification list at all.
- All verification items are vague (e.g. "feature works", "tests pass" without naming what tests, "code is clean").
- Verification items reference checks that cannot be run yet (e.g. "run X" where X is itself not defined anywhere in the PRD).

**Example feedback line on fail**

```
- Phase 2 Verification has no mechanically checkable item (00-master-plan.md, "Phase 2: ..." section)
- Sub-PRD 3 lists "feature works" as the only verification — no command or check named (03-sub-prd-foo.md, "Verification Checklist")
```

---

## 3. Open Questions Enumerated

**What to look for**

- An "Open Questions" section (or equivalent — e.g., "Unresolved", "TBD", "Risks & Open Questions") in `00-master-plan.md`.
- Each unresolved item is a labeled bullet with a one-line statement.
- If the plan has no open questions, the section says so explicitly (e.g. "None at this time" or the section is omitted with a note that all questions were resolved).

**Fail conditions**

- An open question is buried inside a paragraph instead of being captured as a labeled bullet.
- Phrases like "we still need to decide", "this is unclear", or rhetorical questions appear in prose with no corresponding entry in the open-questions section.
- The plan implies unresolved territory (e.g. "future work") without distinguishing which of those items are blocking the current feature versus genuine future scope.

**Example feedback line on fail**

```
- "We still need to decide on retry semantics" appears in prose but is not enumerated as an open question (00-master-plan.md, "Architecture Decision" section)
- Open Questions section is missing — cannot tell whether all questions are resolved or simply not tracked
```

---

## 4. Scope Boundaries Clear

**What to look for**

- An explicit **Out of Scope** statement (section, list, or table) in `00-master-plan.md`.
- The Out-of-Scope list rules out at least one tangential change a reasonable contributor might be tempted to bundle in.
- Sub-PRDs (if present) defer to or extend the master plan's out-of-scope list rather than silently widening scope.

**Fail conditions**

- The PRD says only what is in scope, never what is out.
- "Out of scope" appears as a phrase but with no enumerated items (e.g. just "scope is this feature only").
- A sub-PRD adds work that the master plan does not list as in-scope, with no note acknowledging the expansion.

**Example feedback line on fail**

```
- No Out-of-Scope section — a future implementer cannot tell whether tangential refactors (e.g. dashboard rewrite) belong here (00-master-plan.md)
- Sub-PRD 2 adds a CLI flag not mentioned in the master plan's scope (02-sub-prd-foo.md, "Implementation Steps") — either add to master plan or mark out-of-scope
```

---

## 5. Load-Bearing Assumptions Surfaced

**What to look for**

- The plan names the assumptions on which it depends, in a dedicated "Assumptions" section or as explicit statements inside Architecture / Technical Decisions.
- Each assumption is **falsifiable** (could be checked, in principle) and **load-bearing** (if it turned out to be wrong, the plan would need to change).
- Examples of the kind of assumptions a plan typically relies on: subprocess exit-code semantics, parser behavior on edge inputs, idempotency of an external call, file-locking under concurrency, the existence of an environment variable, the wall-clock cost of an operation.

**Fail conditions**

- The plan depends on an unstated assumption — i.e., a sentence somewhere in the plan only makes sense if the reader silently agrees to a fact the plan never claims (e.g. "we'll branch on the verdict's exit code" without ever saying the verdict process exits 0 on pass).
- Stated assumptions are vague or non-falsifiable ("the system will be reliable").
- A decision in the table relies on an assumption that is not separately recorded.

**Example feedback line on fail**

```
- Plan branches on `claude -p` exit code (00-master-plan.md, "Architecture Decision" diagram) but never states the assumed mapping (0 = success, non-zero = error). If `claude -p` exits 0 on internal failures, the orchestrator misclassifies them as pass.
- Sub-PRD 2 reuses `extractXmlTag` for verdict parsing (02-sub-prd-dev-judge.md) under the unstated assumption that exactly one `<verdict>` block appears in the output. If a phase prints two (e.g. inside a code fence), behavior is undefined.
```

---

## 6. Failure Modes Considered

**What to look for**

- For each external dependency or boundary the plan touches — subprocess, parser, file I/O, network, user signal, timeout, retry — there is at least one sentence on what happens on the unhappy path.
- The plan answers questions like: what if the subprocess crashes? what if the timeout fires mid-write? what if SIGINT arrives during a status-file update? what if the parser returns null? what if two runners race on the same `.run-status.json`?
- May live in a "Failure Modes" / "Error Handling" / "Recovery" section, or be inline in the phase that introduces the dependency.

**Fail conditions**

- A boundary is described in happy-path terms only ("we spawn `claude -p` and read the verdict from its stdout") with no mention of failure semantics.
- A timeout / retry is named with a number but no end-state semantics ("retry cap 2" without saying what's left on disk after the second failure).
- A signal handler is implied but not specified (e.g. "SIGINT-aware" without saying whether the in-flight phase is rolled back, marked stale, or left as-is).

**Example feedback line on fail**

```
- Phase 3 declares a 30 min per-phase timeout (00-master-plan.md, Technical Decisions row 8) but does not say what state `.run-status.json` is in if the timeout fires mid-phase. Is the run marked failed? Is partial work preserved? Can a subsequent run resume from where it stopped?
- Sub-PRD 3 reads and writes `.run-status.json` but does not address concurrent access. Two `dev-workflow run` invocations on the same feature would race; the plan does not say whether file locking is required or whether the second invocation should refuse to start.
```

---

## 7. Counterfactual Sanity

**What to look for**

- The plan acknowledges a meaningfully simpler alternative and either adopts it or explains why it is insufficient.
- "Simpler" can mean: fewer skills, fewer parser changes, no new CLI command, a bash script instead of TypeScript, manual instead of automated, etc.
- The simplest-thing-that-could-work has been considered out loud, not silently rejected.

**Fail conditions**

- A new component (skill, parser, CLI command, dashboard panel) is introduced with no discussion of whether the same outcome could be reached with an existing component plus a small addition.
- "Alternatives Considered" lists alternatives that are all roughly the same scope as the chosen approach, with no genuinely cheaper option included.
- The plan jumps to a sophisticated design (state machine, sidecar file, daemon, retry loop) before justifying why a 50-line straightforward version doesn't suffice.

**Example feedback line on fail**

```
- The orchestrator is described as a CLI command with state machine, retry cap, and sidecar status file (03-sub-prd-run-orchestrator.md). The plan does not consider whether a small bash script that loops `claude -p` calls and inspects the verdict via `grep` would already deliver most of the value. Either build the simpler thing first or state explicitly why it doesn't suffice (e.g. signal handling, JSON parsing, or dashboard integration require more than bash gives).
- Sub-PRD 1 introduces a fourth skill (`dev-quiz`) when the same critique could in principle live as a sub-mode of `/dev-plan` (e.g. `/dev-plan --review-existing`). The plan does not name this alternative or rule it out.
```

---

## Halting Rule

The rubric is finite by design. Walk the seven criteria once, in order. If you find yourself wanting an eighth criterion, that is a signal the rubric needs updating in this file — not a license to extend the quiz inline. Emit the verdict and stop.

When the verdict is `revise`, the feedback should be concrete enough that a contributor can act on it without re-asking. Vague pushback ("have you thought about scaling?") is a non-answer; specific pushback ("Phase 3 assumes < 100 features per repo because the scanner reads them all into memory; if a repo has more, the dashboard will block") is a real second opinion.
