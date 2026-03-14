<div align="center">

# dev-workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.11.0-green.svg)](.claude-plugin/marketplace.json)
[![AgentSkills.io](https://img.shields.io/badge/standard-AgentSkills.io-purple.svg)](https://agentskills.io)

**Multi-session development workflows for Claude Code.**
Plan features with structured PRDs, checkpoint progress, and resume across sessions.

> **Before:** *"Here's where I left off: I was working on the auth feature, finished the login endpoint, the tests are passing, next step is adding the refresh token logic, oh and I decided to use Redis for session storage because..."*
>
> **After:** `/dev-resume`

**[Installation](#installation) · [How It Works](#how-it-works) · [Skills](#skills) · [Why This Workflow?](#why-this-workflow)**

</div>

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

## How It Works

```
  Plan          Build         Checkpoint      New Session     Resume
  ─────         ─────         ──────────      ───────────     ──────
  /dev-plan  →  implement  →  /dev-checkpoint  →  restart  →  /dev-resume
                                                                  │
                                                                  ▼
                                                            build again...
```

| Step | What you do | Why |
|------|-------------|-----|
| **1. Plan** | `/dev-plan` | Generates a structured PRD in `.dev/` |
| **2. Iterate** | Refine the PRD | Get the plan right before building |
| **3. Build** | Implement | Work until context gets heavy |
| **4. Checkpoint** | `/dev-checkpoint` | Saves progress, git state, decisions |
| **5. Restart** | Exit & reopen Claude | Fresh context window |
| **6. Resume** | `/dev-resume` | Claude rebuilds its own implementation plan |
| **7. Build** | Clear context, implement | Focused work with minimal context |

**Repeat steps 3–7** until the feature is complete.

---

## Skills

| Skill | Purpose |
|-------|---------|
| [`/dev-plan`](#dev-plan) | Create a structured PRD for a new feature |
| [`/dev-checkpoint`](#dev-checkpoint) | Save progress and generate a continuation prompt |
| [`/dev-resume`](#dev-resume) | Resume from a previous checkpoint |
| [`/dev-wrapup`](#dev-wrapup) | Review session for learnings and self-improvement |
| [`/dev-status`](#dev-status) | Scan all features and generate a status report |
| [`/dev-board`](#dev-board) | Generate a visual project dashboard |

### `/dev-plan`

Plan a new feature with structured PRD documentation. Three phases:

1. **Understand** — gather requirements (or infer from inline arguments)
2. **Research** — explore the codebase using parallel agents
3. **Write** — produce `.dev/<feature-name>/00-master-plan.md` with status markers and phase gates

```
/dev-plan add OAuth login with Google and GitHub providers
/dev-plan refactor the database layer to use connection pooling
```

### `/dev-checkpoint`

Save progress and generate a continuation prompt:

- Updates PRD status markers (`⬜` → `✅`)
- Captures git state (branch, last commit, uncommitted changes)
- Records session context (decisions, blockers, notes)
- Writes `.dev/<feature-name>/checkpoint.md`

```
/dev-checkpoint
/dev-checkpoint oauth-login
```

### `/dev-resume`

Resume work from a previous checkpoint:

- Loads the checkpoint and verifies context (branch, staleness, drift)
- Builds a focused summary with a concrete "Start with" action
- Handles discrepancies (missing files, branch mismatch)

```
/dev-resume
/dev-resume oauth-login
```

### `/dev-wrapup`

Review the current session for learnings worth persisting. Single-pass analysis that:

- **Scans** for memory candidates (corrections, conventions, project quirks) and improvement signals
- **Routes** findings to the appropriate destination (project docs, scoped rules, user memory)
- **Applies** only after explicit user confirmation

Your accept/skip/reroute decisions are recorded to `.dev/wrapup-feedback.json` — the skill learns your preferences over time. Auto-compacts after 30 sessions.

```
/dev-wrapup
```

### `/dev-status`

Scan all features in `.dev/` and generate a status report:

- Launches parallel agents (batched, max 5) to analyze PRD files
- Displays a summary table with progress and status counts
- Offers to archive completed or stale (>30 days) features to `.dev-archive/`

```
/dev-status
```

### `/dev-board`

Generate a project dashboard from `.dev/` feature data:

- **HTML board** — visual dashboard with feature cards, progress bars, and status indicators
- **Stakeholder summary** — markdown report for sharing with team leads

```
/dev-board
```

---

## Git Tracking

`.dev/` and `.dev-archive/` are tracked in git by default — PRDs, checkpoints, and archived features become part of your project history. To exclude them:

```
# .gitignore
.dev/
.dev-archive/
```

---

## Why This Workflow?

Complex features overflow context windows. This workflow saves structured progress to disk so you can clear context and resume without re-explaining everything.

The pattern emerged from a recurring problem: planning a complex feature consumes most of the context window before you even start building. Then the build phase spans multiple sessions. Without structure, each restart requires re-explaining the plan, the decisions made, and where you left off.

**The solution is a cycle:**

1. **Plan to disk** — `/dev-plan` persists a structured PRD so the plan survives context resets
2. **Checkpoint progress** — `/dev-checkpoint` captures just enough state (git, decisions, next steps) for the next session to pick up efficiently
3. **Resume with minimal context** — `/dev-resume` loads only the checkpoint, not the full PRD, keeping context lean

### Tips

- **Checkpoint before context fills up** — don't wait until you're forced to restart
- For complex features, explicitly ask Claude to **break the PRD into sub-documents** during `/dev-plan`

## Acknowledgments

The `/dev-wrapup` skill was inspired by a [community post on r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1r89084/selfimprovement_loop_my_favorite_claude_code_skill) describing a "self-improvement loop" skill. We adapted the concept to fit the dev-workflow philosophy where nothing is applied without explicit user confirmation.

## Credits

Inspired by:
- [get-shit-done](https://github.com/glittercowboy/get-shit-done)
- [ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)

## License

MIT
