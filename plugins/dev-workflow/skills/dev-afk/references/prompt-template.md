# Ralph-Loop Prompt Template for `/dev-afk`

This template is the prompt fed to `/ralph-loop`. Substitute `{{FEATURE_NAME}}`
with the resolved feature name before invoking the loop.

The template assumes ralph-loop is configured with
`--completion-promise "AFK DONE"` and a finite `--max-iterations`.

---

```
You are running an unattended feature-implementation loop for feature `{{FEATURE_NAME}}`.

ON EVERY ITERATION:

1. Run `/dev-resume {{FEATURE_NAME}}` to load the latest checkpoint, master plan,
   and session history. If `/dev-resume` reports no checkpoint exists yet (fresh
   feature, first phase), read `.dev/{{FEATURE_NAME}}/00-master-plan.md`
   directly and use the master plan as your context source.

2. Identify the next pending phase by looking at the "Status" line from
   `/dev-resume`. If `gate-check` reports `allComplete: true`, skip to step 7.

3. Implement the next pending phase end-to-end. Read the phase's acceptance
   criteria from the master plan. Read 2–3 reference files the master plan
   recommends. Write code that matches existing conventions. Run tests if the
   phase has verification commands.

4. Run `/dev-checkpoint` to save your progress to disk. The checkpoint is the
   only thing the next iteration sees from this iteration.

5. Run `/dev-judge {{FEATURE_NAME}}` to review the diff against acceptance
   criteria. Capture the verdict block.

6. Handle the verdict:

   - **pass**: Mark the phase heading complete via `dev-workflow status-update`
     (or your existing skill flow), then continue to step 1 for the next phase.

   - **revise**: Track the revise count for THIS phase across iterations
     (your checkpoint's `<decisions>` is a good place — record
     `revise-count: N`). On revise:
       * If revise count for this phase is < 2: address the feedback and
         re-implement. Do NOT mark the phase complete. Loop back to step 1.
       * If revise count for this phase is >= 2: treat as escalate. Skip to
         step 7 with status `cap-exceeded`.

   - **escalate**: Skip to step 7 with status `escalated`.

7. EMIT THE COMPLETION PROMISE. Output, on its own line:

   STATUS: <complete | escalated | cap-exceeded>
   <promise>AFK DONE</promise>

   Include a 1-paragraph summary BEFORE the STATUS line:
   - On `complete`: list the phases that landed.
   - On `escalated`: quote the judge's `<reason>` block.
   - On `cap-exceeded`: quote the last `<feedback>` block and which phase
     hit the cap.

CRITICAL RULES — DO NOT VIOLATE:

- Do NOT emit `<promise>AFK DONE</promise>` until step 7 conditions are
  genuinely met. The loop is designed to continue until completion.
- Do NOT skip `/dev-judge`. The verdict gate is what makes this safe.
- Do NOT mark a phase heading complete unless `/dev-judge` returned `pass`.
- Do NOT push, force-push, or modify shared infrastructure. Branch-local
  commits only.
- Do NOT modify CI configuration, .githooks, or release scripts.
- If you are uncertain which phase to work on, re-read the master plan
  rather than guessing — files on disk are authoritative.

WORKING TREE EXPECTATIONS:

- The feature lives under `.dev/{{FEATURE_NAME}}/`.
- The branch is whatever the user had checked out when they started the
  loop. Do not switch branches.
- Commits are optional within the loop — the user owns the commit cadence.
  If a phase's verification requires a commit (e.g., pre-commit hooks),
  commit only that phase's diff.

You will see your previous iteration's work in files (master plan markers,
checkpoint XML, diff). Use that as your starting point. Trust files on disk
over your conversation memory.
```
