---
name: dev-afk
description: >-
  Drive a feature's pending phases unattended via ralph-loop, gated by /dev-judge.
  Composes /dev-resume, /dev-checkpoint, and /dev-judge into a self-referential
  loop that iterates one phase at a time. Requires the `ralph-loop` plugin from
  the official Claude marketplace.
argument-hint: "<feature-name> [--max-iterations N]"
allowed-tools: Bash(bash:*) Bash(node:*) Bash(git rev-parse:*) Read
---

## AFK Mode (experimental)

Loop a feature's pending phases without supervision. Each iteration calls
`/dev-resume` to load context from disk, implements the next phase,
`/dev-checkpoint`s, then `/dev-judge`s the diff. The loop continues until the
feature is complete, the judge escalates, or the iteration cap is hit.

### Scale guidance

Best for **1–3 phase features**. Ralph-loop runs in the current Claude Code
session, so context accumulates across iterations. For 5+ phase features,
auto-compaction may degrade fidelity exactly when the agent needs to read its
own checkpoints accurately. If you have a long feature, split it or run phases
manually.

### Step 0: Discover Project Root

```bash
bash "$DISCOVER" root
```

Where `$DISCOVER` is the absolute path to `scripts/discover.sh` within this
skill's directory. Use `$HOME` instead of literal home directories on every
call. Copy paths verbatim from previous tool output. Stop on any non-zero
exit.

Store the output as `$PROJECT_ROOT`.

### Step 1: Resolve the Feature Argument

The feature name comes from `$ARGUMENTS` (first positional argument). If it
is empty, ask the user which feature to run and stop.

### Step 2: Preflight via `dev-workflow list --afk`

Verify the feature is AFK-runnable before spending model time on the loop:

```bash
node "$CLI" list --json --afk --scan "$PROJECT_ROOT"
```

Where `$CLI` is the absolute path to `scripts/dev-workflow.cjs` within this
skill's directory.

Parse the JSON output. Look in `projects[].features[]` for an entry whose
`name` matches `$ARGUMENTS`.

| Outcome | Action |
|---------|--------|
| Feature found, `afk.runnable: true` | Continue to Step 3 |
| Feature not in `--afk` list | Run `list --json` (without `--afk`), report why it's blocked, stop |
| Feature not found at all | Report "feature not found under .dev/", stop |

### Step 3: Confirm Ralph-Loop is Installed

The runner is the [ralph-loop plugin](https://github.com/anthropics/claude-plugins-official) from the official Claude marketplace. If `/ralph-loop` is not available in this session, stop and tell the user:

> AFK mode requires the `ralph-loop` plugin from the official marketplace. Install it with `/plugins`, then re-run `/dev-afk`.

### Step 4: Compose the Loop Prompt

Read [the prompt template](references/prompt-template.md) and substitute
`{{FEATURE_NAME}}` with the resolved feature name. The template encodes:

- `/dev-resume` → implement next phase → `/dev-checkpoint` → `/dev-judge`
- Pass / revise / escalate handling
- Retry cap (2 revises before treating as escalate, mirroring the prior
  orchestrator's default)
- Completion-promise emission rules (single promise, surrounding status text
  carries pass/escalate/cap-exceeded detail)

### Step 5: Invoke `/ralph-loop`

Default iteration cap is `--max-iterations 20`. If the user supplied
`--max-iterations N` in `$ARGUMENTS`, use that instead.

Invoke the ralph-loop slash command with the composed prompt and the
completion promise `AFK DONE`:

```
/ralph-loop "<composed prompt with feature interpolated>" --completion-promise "AFK DONE" --max-iterations <N>
```

The prompt is multi-line. Pass it as the positional argument to `/ralph-loop`.

### Step 6: Print Monitoring Tip

After invoking the loop, tell the user how to follow progress without
disrupting the session:

> Monitor with: `head -10 .claude/ralph-loop.local.md` (current iteration)
> Or watch the dashboard: features change as `/dev-checkpoint` updates land.
> To cancel: `/cancel-ralph` or hit the iteration cap.

### Stops and Gates

The loop stops when:

- `<promise>AFK DONE</promise>` is emitted (prompt instructs the agent to
  emit it on success, escalate, or retry-cap exhaustion — surrounding text
  carries the status detail)
- `--max-iterations` is reached
- The user runs `/cancel-ralph`

Ralph re-feeds the same prompt every iteration. Files on disk (PRD,
checkpoint, session log) are the authoritative state carrier between
iterations — the loop intentionally relies on `/dev-resume` for fresh
context-from-disk on every pass.

### PRIVACY RULES

Never include absolute paths with usernames, secrets, or personal info in
the composed prompt. Use feature names and relative paths only. The prompt
is logged into `.claude/ralph-loop.local.md` and visible across all loop
iterations.
