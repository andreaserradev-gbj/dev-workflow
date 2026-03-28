<div align="center">

# dev-workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.26.2-green.svg)](.claude-plugin/marketplace.json)
[![AgentSkills.io](https://img.shields.io/badge/standard-AgentSkills.io-purple.svg)](https://agentskills.io)

**AI coding agents forget everything between sessions. This fixes that.**

Context fills up. You restart. Twenty minutes re-explaining what you were building, what you decided, where you left off. Or:

`/dev-resume`

<img src="docs/demo-resume.svg" alt="dev-resume reconstructs full context from a 2KB checkpoint" width="520"/>

</div>

---

**Three commands. That's it.** `/dev-plan` once to create a plan. `/dev-checkpoint` when you stop. `/dev-resume` when you come back. Everything comes back — decisions, progress, blockers, the exact next step. Try it once.

---

## The Problem

LLM performance degrades as context fills up. This isn't a theoretical concern — after ~200K tokens of accumulated conversation, tool outputs, and debugging tangents, responses get slower, details get missed, and earlier decisions get contradicted. Even with 1M context windows, **more context means worse output**.

Every developer using AI coding agents hits the same wall:

- **Session 1:** Great output. Claude is sharp, follows the plan, remembers everything.
- **Session 1 (continued):** Context filling up. Responses slower. Starts forgetting things you discussed 30 minutes ago.
- **Session 2:** Fresh start. But now you're the one who has to remember everything and re-explain it. Poorly.

The common workaround? Manually copy plans into files, paste fragments back into new sessions, hope you didn't forget anything important. It works. It's also tedious, error-prone, and doesn't scale past one feature.

**dev-workflow automates this.** It saves structured progress to disk — not conversation dumps, but the specific state needed to resume: what's done, what's next, what was decided, and what to watch out for. Each new session starts clean with minimal context and full continuity.

---

## How It Works

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
| **5. Resume**     | `/dev-resume`           | Loads ~2KB checkpoint, rebuilds context, picks up where you left off |

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

### Codex

Tell Codex:

> Clone `https://github.com/andreaserradev-gbj/dev-workflow.git` and follow `.codex/INSTALL.md` from the local checkout.

Or see [docs/README.codex.md](docs/README.codex.md) for manual setup.

### Gemini CLI

```bash
gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

Or see [docs/README.gemini.md](docs/README.gemini.md) for alternatives.

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

### `/dev-wrapup` — Extract session learnings

Reviews the conversation for insights worth keeping:

- Scans for corrections, conventions, and project quirks
- Routes findings to the right place (project docs, scoped rules, user memory)
- Applies nothing without explicit confirmation
- Learns your preferences over time via `.dev/wrapup-feedback.json`

```
/dev-wrapup
```

### `/dev-dashboard` — Live cross-project view

<img src="docs/dashboard-preview.png" alt="Dev Dashboard showing projects with feature progress, status badges, and phase tracking" width="720"/>

A local web server that scans `.dev/` folders across all your projects and shows live feature status in the browser. Real-time updates via WebSocket — edit a PRD and the dashboard reflects changes instantly. Works with any AI coding tool (Claude Code, Codex, Gemini CLI, etc.) — it reads `.dev/` PRDs directly, no AI integration needed.

```
/dev-dashboard
```

Starts the server (or reuses an existing instance) and displays the URL. No setup required — the server is bundled with the plugin.
On first run, `/dev-dashboard` also installs local `dev-dashboard` and `dev-dashboard-stop`
commands so future terminal launches reuse the same bundled launcher.

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
| `scanDirsConfigured` | `boolean`  | `false` | Marks whether first-run scan-directory onboarding has been completed |

See [tools/dev-dashboard/README.md](tools/dev-dashboard/README.md) for CLI flags and more details.

</details>

<details>
<summary>Running from the terminal</summary>

Run `/dev-dashboard` once to install the local commands, then use:

```bash
dev-dashboard
dev-dashboard-stop
```

The installer writes Unix command shims to `~/.local/bin` by default, or to
`$DEV_DASHBOARD_BIN_DIR` if you override it. If the install reports that the bin
directory is not on `PATH`, add that directory to your shell config before using
the commands directly in a terminal.

This installer-backed path is the primary terminal UX for this release. Manual
shell snippets are no longer the recommended default.

</details>

---

## Design Principles

**Composable, not prescribed.** Each skill is independent. Use `/dev-plan` without `/dev-checkpoint`. Use `/dev-resume` alongside `/code-review`, Jira, Slack, or any other tool. Start a session without any plan at all. The skills work together but never force a sequence.

**Plans are living documents.** PRDs have status markers (`⬜` / `✅` / `⏭️`) and phase gates (`⏸️ GATE`). They're meant to be edited mid-flight — add phases, skip steps, rewrite sections when requirements change. Checkpoints capture the decisions behind those changes.

**Context quality over context quantity.** Checkpoints are structured compression — they preserve what matters (state, decisions, next actions) and deliberately discard what doesn't (debugging tangents, tool output, failed attempts). Each resumed session starts lean.

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
