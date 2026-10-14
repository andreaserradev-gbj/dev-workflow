---
name: dev-orchestrator
description: >-
  Run one checkpointed feature end-to-end in a single in-session loop:
  re-derive position from the feature checkpoint, execute every phase's
  numbered steps in-session, tick each step only on named verification
  evidence, auto-checkpoint and auto-continue at every gate, and page
  the human only for anomalies (a verification failing without a fix,
  an architectural preference call, an external or irreversible action,
  missing key or PRD files, a drifted branch, or another loop-blocking
  state it cannot resolve).
  Use when a checkpointed feature should run hands-off without per-step
  supervision.
argument-hint: <feature name>
allowed-tools: Bash(bash:*) Bash(node:*) Read Edit Write
---

## Run One Feature In-Session

You are the runner. One agent session executes every phase of a
checkpointed feature end-to-end. There are no worker agents and no
fresh contexts per step: the session itself implements, verifies, and
ticks. Disk state is the only durable memory — the PRD markers, the
checkpoint, and `session-log.md`. Conversation memory is the thing
that drifts; artifacts don't.

At launch, announce the scope and the paging rules (feature, current
phase, step count, gates ahead, what pages the human) and start
running. There is no confirmation question: one invocation authorizes
the whole run. External actions (push, PR, merge) stay with the user
in every case.

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

### Step 1: Identify Feature, Validate, Load Context

Identify and validate exactly as dev-resume does:

```bash
bash "$DISCOVER" checkpoints "$PROJECT_ROOT" "$ARGUMENTS"
```

Pass `$ARGUMENTS` as the third argument only if the user provided one; omit it otherwise. If the script exits non-zero (no `.dev/` directory): inform the user, stop. If output is empty: no checkpoints found — page the user. If one line: use as `$CHECKPOINT_PATH`. If multiple lines: page the user with the list. Never construct paths from raw `$ARGUMENTS`.

Then validate:

```bash
bash "$VALIDATE" checkpoint-path "$CHECKPOINT_PATH" "$PROJECT_ROOT"
```

Where `$VALIDATE` is the absolute path to `scripts/validate.sh` within this skill's directory. Outputs `$FEATURE_NAME` on success; on failure, **STOP immediately** (missing key file — page). Set `$FEATURE_DIR` to `$PROJECT_ROOT/.dev/$FEATURE_NAME`.

Load the context packet:

```bash
node "$CLI" resume-context --json --dir "$FEATURE_DIR"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this skill's directory. Parse the JSON output (`feature`, `checkpoint`, `validity`, `currentPhasePrd`, `referenceFiles`, `sessionDigest`, `recentSessionHistory`, `accumulatedDecisions`). A non-zero exit means the command failed — stop and report; do not reconstruct data from separate tool calls.

**Validity handling**: `fresh` → proceed; `stale` → informational warning, proceed; `drifted` → page the user ("Checkpoint was on `X`, you're on `Y`. Switch or continue?") and wait.

**Re-derive position directly**: `resume-context` omits `currentState` and `keyFiles` by design, so read `$FEATURE_DIR/checkpoint.md` directly for those fields plus prior decisions and blockers. Phase position comes from `currentPhasePrd`: the first ⬜ step is next; ticked steps are done.

**Discrepancy handling while running**: key file missing/renamed → page; PRD files missing → page (cannot resume); new files → proceed, mention in the recap; file differs from checkpoint → proceed, note drift. Read `referenceFiles` before touching the phase's first step.

### Step 2: Execute the Phase Loop

For the current phase, iterate over its numbered steps in text order, one at a time, in-session.

**Lane rules — route every obstacle:**

- **Resolvable** — reversible and tool-fixable (failing test, bad import, typo'd path): fix it, re-run the verification. The same repair failing twice counts as stopped.
- **Queued** — reversible but a genuine preference between two valid designs (a choice touching a cross-module interface, or contradicting the PRD's stated approach): this is paged, not picked — see the paging contract. Small local style/wording calls are not queued: pick the simple option and record it in the decision trail.
- **Stopped** — irreversible, external, or a boundary (push, PR, merge, publish, branch switch, deletion outside the feature's scope): pause, then present one decision request.

**Decision trail**: record material decisions (scope, architecture, risk, next unit) — each with its fork and why the chosen path won — as they happen. They ride into the gate recap's **Choices** section and into the checkpoint's `decisions`. Do not log every command; log the ones that materially change the plan.

**Evidence-gated tick.** Each PRD step ends with a `— verify:` clause. Run that verification yourself and observe the output before ticking. Never tick from intention, from a plan, or from confidence alone. On the tick:

```bash
node "$CLI" status-update --json --dir "$FEATURE_DIR" --phase <N> --step <M> --marker done
```

`--marker` accepts `done` (→ ✅) or `todo` (→ ⬜) only. Non-zero exit → stop and report; do not force the update. A verification failing and not fixable under the lane rules → page. Keep the verification output for the recap's Evidence section.

After a step tick, phase auto-advance is handled by the parser: when the last step of a phase is ticked, the next phase becomes current — no CLI call needed.

### Gate: Checkpoint, Recap, Auto-Continue

After the phase's last step is ticked:

```bash
node "$CLI" gate-check --json --dir "$FEATURE_DIR"
```

Check the `atGate` field and the optional `warnings` field (present only when the PRD has rows whose status marker could not be read). If the gate is not reached — an unticked step, or a parse warning surfaced in `warnings` — resolve under the lane rules or page before continuing. Do not recap past an unmet gate.

If it is reached:

1. **Report the recap**, checked against the phase's PRD steps, in this order:
   - **Impact** — what the phase does now that it didn't before.
   - **Choices** — key decisions, each with its fork; queued items called out for revisit.
   - **Evidence** — file:line and test names, taken from the verification commands you ran.
   - **Gaps** — unverified claims, skipped steps, open questions.
2. **Write the checkpoint** via `checkpoint-write`, composing `CheckpointWriteInput` JSON with at least `context`, `currentState`, `nextAction`, `keyFiles` (required), plus `decisions`, `blockers`, `notes`. The CLI never calls git — supply `branch`, `lastCommit`, and `uncommittedChanges` yourself (`git rev-parse --abbrev-ref HEAD`, `git rev-parse --short HEAD`, `git status --porcelain` non-empty → `true`).

   Reuse the dev-checkpoint skill's `--input-file` recipe exactly: **Write** the JSON to `$FEATURE_DIR/.checkpoint-input.json` (the `Write` tool handles real newlines; `echo | --stdin` cannot), **run** `node "$CLI" checkpoint-write --json --dir "$FEATURE_DIR" --input-file "$FEATURE_DIR/.checkpoint-input.json"`, **delete** the input file on success (`rm -f`), leave it and STOP on failure — the checkpoint was NOT saved. **Do NOT manually write `checkpoint.md` or `session-log.md`** — the CLI ensures format compatibility and handles session-log accumulation.

3. **Auto-continue** to the next phase without asking. Announce the next phase (title, step count, gate at its end) and re-enter the phase loop at Step 2. One run covers every phase.

At the **last gate** (`allComplete` in gate-check output): deliver the final summary in the same Impact/Choices/Evidence/Gaps order plus overall feature state, suggest `/dev-checkpoint` for the session wrap-up, and **stop**. No further phase work.

### Paging Contract

Pause-and-wait for every run-loop anomaly:

- A verification failing with no fix after one attempt (the same repair failing twice = stop). The page shows: attempted paths, the fork, verified current state, exact next action.
- An architectural preference call: a choice touching a cross-module interface, or contradicting the PRD's stated approach.
- Missing key or PRD files; a drifted branch (checkpoint valid on `Y`, working tree on `X` — not fixable by you).
- Discovery/validation refusing, an untickable step, or a gate-refusing state you cannot resolve — including any parse warning surfaced by `gate-check` you cannot clear.

Everything in the Safety Summary below is a permanent page-in-every-case list; this section only adds the loop's transient triggers. While paged, do not start other phases' work. Resume when the user answers.

### Mid-Run Skips

A step can be skipped, dropped, or deferred only by editing the PRD marker by hand — `status-update` writes ✅/⬜ only and refuses to overwrite any glyph it does not recognize. The resolved glyphs are `✅` done, `⏭️` skipped, `⛔` dropped, `⏹️` deferred; all count toward phase completion. Apply the hand edit to `00-master-plan.md` (or the named sub-PRD) with the `Edit` tool on the user's explicit request — never on the run's own initiative. After the edit, the user's "continue" re-enters the phase loop: re-derive position from the PRD (the first remaining ⬜ is next; the edited glyph counts as done). A skipped step always appears in the recap's Gaps.

### Crash Recovery

State lives in the PRD markers and `checkpoint.md`; a fresh session re-running `/dev-orchestrator` re-derives position via `resume-context` plus a direct `checkpoint.md` read: ticked steps are done, the first ⬜ is next. Nothing to replay, nothing to reconcile manually.

### Safety Summary

Always page the user (never act):

- `git push`, opening a PR, merging, publishing, branch switch
- destructive operations (deletions, writes outside the feature's scope)
- trust screens, sign-ins, interactive credential entry
- anything with outward-facing effect (sending mail or messages, external services)
- plugin configuration changes; `safety yolo` (never, under any circumstance)
- "always allow"-style permissions (never grant blanket grants)
- two failed repairs of the same step; any state you cannot resolve under the lane rules

---

## PRIVACY RULES

Warn the user if checkpoint/PRD files contain: absolute paths with usernames, secrets/credentials, or personal information. Strip anything private from text the session emits into logs or the trail before writing it.