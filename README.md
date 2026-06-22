<div align="center">

# dev-workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.37.1-green.svg)](.claude-plugin/marketplace.json)
[![AgentSkills.io](https://img.shields.io/badge/standard-AgentSkills.io-purple.svg)](https://agentskills.io)

**AI coding agents start every session from zero. Your architecture shouldn't.**

You stop, you restart. Twenty minutes re-explaining what you were building, what you decided, where you left off. Or:

`/dev-resume`

<img src="docs/demo-resume.svg" alt="dev-resume reconstructs focused context from a saved checkpoint" width="520"/>

</div>

---

**The loop is three commands.** `/dev-plan` once to create a plan. `/dev-checkpoint` when you stop. `/dev-resume` when you come back. What matters comes back — decisions, progress, blockers, the exact next step. Try it once.

---

## Why I Built This

I kept hitting the same wall. I'd architect a feature with the agent across a long session, then every restart meant re-explaining what I was building from memory, badly. I tried keeping notes by hand, but they always drifted out of sync with the actual code.

It started small: a plan I could write once, a checkpoint I could save when I stopped. But the real problem was bigger than one feature, so it grew. Session history carries continuity across restarts, and a cross-project wiki indexes every feature I've worked on. Now a fresh session knows more than where one feature left off. It starts with the whole picture, across projects and across tools (Claude Code, Codex, and other AgentSkills.io agents).

---

## How I Work

I architect the feature. The agent implements it and brainstorms with me. I review every line it writes, including the boilerplate that slips through. When something ships and works, that is on me. When it breaks, also me. The agent is an implementer and a sparring partner, never the decision-maker.

The hard part was never the model. It is keeping my own design intent canonical across sessions that are days apart, sometimes across projects. A plan I set on Monday has to still drive the work on Thursday, after the conversation that produced it is gone. If the only record of why we built it this way lives in a chat window, it dies when the window closes, and the next session quietly drifts off the architecture I set.

dev-workflow is the discipline I use to stop that drift. The PRD is the architecture I own. The checkpoint is the state I verify before I stop. Resuming reloads my decisions instead of asking the model to recall them. Nothing here makes the model smarter or claims a token saving. It keeps the engineer in the architect's seat across sessions.

**When it earns its keep:** complex features that span multiple sessions where you are holding a real architecture in your head. **When it does not:** a quick fix or a single-session change, where `git log` and a note to yourself are already enough. Don't build infrastructure for marginal value.

---

## The Loop

```
  Plan          Build         Checkpoint      New Session     Resume
  ─────         ─────         ──────────      ───────────     ──────
  /dev-plan  →  implement  →  /dev-checkpoint  →  restart  →  /dev-resume
                                                                  │
                                                                  ▼
                                                            build again...
```

| Step              | What you do             | What happens                                                         |
| ----------------- | ----------------------- | -------------------------------------------------------------------- |
| **1. Plan**       | `/dev-plan`             | Generates a structured PRD in `.dev/` with phases and gates          |
| **2. Build**      | Implement               | Work until context gets heavy                                        |
| **3. Checkpoint** | `/dev-checkpoint`       | Saves progress, git state, decisions, next steps                     |
| **4. Restart**    | Close and reopen Claude | Fresh context window, clean slate                                    |
| **5. Resume**     | `/dev-resume`           | Loads the checkpoint, rebuilds context, picks up where you left off |

**Repeat steps 2–5** until the feature is complete. Each session starts fresh with high-quality context.

---

## Installation

### Claude Code (Plugin)

```
/plugin marketplace add andreaserradev-gbj/dev-workflow
/plugin install dev-workflow
```

<details>
<summary>Updating & Troubleshooting</summary>

```
/plugin marketplace update dev-workflow
```

If the plugin doesn't load after updating, clear the cache and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/dev-workflow
rm -rf ~/.claude/plugins/marketplaces/dev-workflow
```

Then re-run the install commands above.

</details>

### Codex, pi, OpenCode, and other AgentSkills.io agents

These agents discover skills from `~/.agents/skills/`. Install with the AgentSkills.io standard CLI:

```bash
npx skills add andreaserradev-gbj/dev-workflow
```

All seven install at once, managed by `npx skills` (`list`, `update`, `remove`).

> **Already using the Claude Code plugin?** The installer detects the agents on your `PATH` and may offer Claude Code as a target. **Decline it** — installing again gives you every skill twice (once from the plugin, once under `~/.claude/skills/`). This command is for the agents that read `~/.agents/skills/`.

<details>
<summary>No Node? Standard-tools equivalent (curl + tar)</summary>

```bash
mkdir -p ~/.agents/skills
curl -fsSL https://github.com/andreaserradev-gbj/dev-workflow/archive/refs/heads/main.tar.gz \
  | tar -xz -C ~/.agents/skills --strip-components=4 \
        dev-workflow-main/plugins/dev-workflow/skills
```

</details>

See [docs/README.codex.md](docs/README.codex.md) for the skill list and Codex-specific notes.

---

## Skills

### `/dev-plan` — Plan a feature

Creates a structured PRD with phases, status markers, and gates. Three phases:

1. **Understand** — gather requirements (or infer from inline arguments)
2. **Research** — explore the codebase using parallel agents
3. **Write** — produce `.dev/<feature-name>/00-master-plan.md`

```
/dev-plan add OAuth login with Google and GitHub providers
/dev-plan refactor the database layer to use connection pooling
```

### `/dev-checkpoint` — Save progress

<img src="docs/demo-checkpoint.svg" alt="dev-checkpoint saves progress, decisions, and blockers" width="520"/>

Captures everything needed to resume later:

- Updates PRD status markers (`⬜` → `✅`)
- Captures git state (branch, last commit, uncommitted changes)
- Records decisions, blockers, and next steps
- Writes `.dev/<feature-name>/checkpoint.md`

```
/dev-checkpoint
/dev-checkpoint oauth-login
```

### `/dev-resume` — Pick up where you left off

Reconstructs context from a checkpoint:

- Loads the checkpoint and verifies state (branch, staleness, drift)
- Builds a focused summary with a concrete "Start with" action
- Enforces phase gates — won't skip ahead without your approval

```
/dev-resume
/dev-resume oauth-login
```

### `/dev-review` — PRD-vs-implementation alignment report

Spawns a fresh reporter subagent that explores the codebase and compares what was actually built against the feature's PRD. Produces a concise, scannable report — tables and bullets, not a wall of prose: deviations from the plan, constraints that affect future decisions, and untested areas, each with a verdict chip and a `file:line`. Built for the architect who knows the overall picture and triages in under a minute. Afterward it offers to apply the doc corrections it surfaces back to your PRD and checkpoint — it never edits code and never writes a standalone `review.md`.

Use when a feature's implementation is finished (or nearly), before final testing.

```
/dev-review
/dev-review oauth-login
```

### `/dev-wrapup` — Extract session learnings

Reviews the conversation for insights worth keeping:

- Scans for corrections, conventions, and project quirks
- Routes findings to the right place (project docs, scoped rules, user memory)
- Applies nothing without explicit confirmation
- Remembers your past decisions via a feedback log (`.dev/wrapup-feedback.json`)

```
/dev-wrapup
```

### `/dev-dashboard` — Live cross-project view

<img src="docs/dashboard-preview.png" alt="Dev Dashboard showing projects with feature progress, status badges, and phase tracking" width="720"/>

A local web server that scans `.dev/` folders across all your projects and shows live feature status in the browser. Real-time updates via WebSocket — edit a PRD and the dashboard reflects changes instantly. Works with any AI coding tool (Claude Code, Codex, etc.) — it reads `.dev/` PRDs directly, no AI integration needed.

```
/dev-dashboard
```

Starts the server (or reuses an existing instance) and displays the URL. No setup required — the server is bundled with the plugin and launches directly through `/dev-dashboard`.

The dashboard also auto-generates a cross-project wiki (see `/dev-wiki` below).

**Dashboard actions:**

| Action               | Where                                   | What it does                                                  |
| -------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Archive**          | Feature row / panel (complete features) | Moves `.dev/<name>` to `.dev-archive/` with confirmation      |
| **Restore**          | Feature row / panel (archived features) | Moves `.dev-archive/<name>` back to `.dev/` with confirmation |
| **Copy as Markdown** | Report view                             | Copies activity report as formatted markdown                  |

<details>
<summary>Configuration</summary>

Config lives at `~/.config/dev-dashboard/config.json` (created automatically on first run). Fresh installs start with no scan roots, and the dashboard prompts you to save them explicitly on first launch:

```json
{
  "scanDirs": ["~/code", "~/work"],
  "port": 3141,
  "notifications": false,
  "scanDirsConfigured": true
}
```

| Field                | Type       | Default | Description                                                          |
| -------------------- | ---------- | ------- | -------------------------------------------------------------------- |
| `scanDirs`           | `string[]` | `[]`    | Directories to scan for projects containing `.dev/` folders          |
| `port`               | `number`   | `3141`  | HTTP server port                                                     |
| `notifications`      | `boolean`  | `false` | Reserved for future notification support                             |
| `wikiDir`            | `string`   | `~/.dev-wiki` | Output directory for the auto-generated wiki                         |
| `scanDirsConfigured` | `boolean`  | `false` | Marks whether first-run scan-directory onboarding has been completed |

See [tools/dev-dashboard/README.md](tools/dev-dashboard/README.md) for CLI flags and more details.

</details>

<details>
<summary>Network binding</summary>

The server binds to `127.0.0.1` (localhost only) by default. To expose it on your
LAN, opt in explicitly with `DEV_DASHBOARD_HOST=0.0.0.0` (or the `--lan` / `--host`
flags when running the server directly). A LAN bind is logged with a warning at
startup.

</details>

### `/dev-wiki` — Cross-project wiki

Gives `/dev-plan` a memory of every feature you've shipped. Before researching, the plan skill consults the wiki index for prior art, so a new plan inherits the decisions and nuances of past features instead of rediscovering them. It's retrieval over your own history, built from plain markdown and an index rather than a local vector DB you'd have to run and maintain. You never refresh it by hand: when the dashboard server is running it regenerates the wiki automatically as PRDs change, so the index `/dev-plan` reads stays current. The Obsidian graph view is a bonus, not the point.

Mechanically, it generates a set of markdown files at `~/.dev-wiki/` (configurable) from all `.dev/` and `.dev-archive/` PRDs across your projects, with symlinks back to the original PRD directories.

```
/dev-wiki
```

**What it produces:**

| File | Contents |
| ---- | -------- |
| `index.md` | Per-project feature tables with status, progress, and summaries |
| `log.md` | Chronological activity log across all projects |
| `README.md` | Obsidian setup instructions |
| `projects/` | Symlinks to each project's `.dev/` and `.dev-archive/` directories |

**Automatic vs on-demand:** The dashboard server regenerates the wiki on every state change (500ms debounce). `/dev-wiki` is the on-demand path for when the dashboard isn't running.

**Obsidian integration:** Open `~/.dev-wiki/` as an Obsidian vault for graph view, backlinks, and Dataview queries across all your features. The wiki uses standard CommonMark — no Obsidian-specific syntax.

**Skill integration:** `/dev-resume` also references the index for cross-project context. Both `/dev-plan` and `/dev-resume` skip silently when the wiki doesn't exist.

The CLI equivalent is also available:

```bash
dev-workflow wiki-index              # scan and show summary
dev-workflow wiki-index --generate   # generate wiki files
dev-workflow wiki-index --json       # JSON output for scripts
```

---

## Design Principles

**Composable, not prescribed.** Each skill is independent. Use `/dev-plan` without `/dev-checkpoint`. Use `/dev-resume` alongside `/code-review`, Jira, Slack, or any other tool. Start a session without any plan at all. The skills work together but never force a sequence.

**Plans are living documents.** PRDs have status markers (`⬜` / `✅` / `⏭️`) and phase gates (`⏸️ GATE`). They're meant to be edited mid-flight — add phases, skip steps, rewrite sections when requirements change. Checkpoints capture the decisions behind those changes.

**Context quality over context quantity.** Checkpoints are structured compression: they preserve what matters (state, decisions, next actions) and deliberately discard what doesn't (debugging tangents, tool output, failed attempts). Each resumed session starts lean.

**The checkpoint is yours.** It is a document you own, not a memory you trust. The agent drafts it; you read it before you stop. A checkpoint that misstates the state is one you fix in ten seconds, the same way you fix boilerplate that slipped into a diff. It is a review surface, not a black box.

---

## Architecture Notes

A few decisions that shaped the design:

- **Agent-first CLI.** The skills are backed by a CLI built for machines, not humans: structured `--json` output and deterministic exit codes, so an agent can call it and branch on the result reliably.
- **Tool-agnostic.** Skills follow the [AgentSkills.io](https://agentskills.io) standard and target abstract destinations resolved at runtime, so the same workflow runs under Claude Code, Codex, and other AgentSkills.io agents.
- **One source of truth, enforced.** A shared TypeScript core (parser, scanner, types) is bundled into each skill; git hooks block any commit where source changed without rebuilding the bundle, or a plugin change without a version bump.
- **Live dashboard over plain files.** The cross-project dashboard reads `.dev/` PRDs directly and pushes updates over WebSocket, no AI integration required, so it works with any tool that writes the format.

---

## Git Tracking

`.dev/` and `.dev-archive/` are tracked in git by default — PRDs, checkpoints, and archived features become part of your project history. To exclude them:

```
# .gitignore
.dev/
.dev-archive/
```

---

## Tips

- **Checkpoint before context fills up** — don't wait until you're forced to restart
- **Use `/dev-plan` for complex features** — for quick fixes, just work directly
- For large features, ask Claude to **break the PRD into sub-documents** during `/dev-plan`

## License

MIT
