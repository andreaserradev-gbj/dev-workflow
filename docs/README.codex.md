# dev-workflow for Codex

Use dev-workflow skills with OpenAI Codex via native skill discovery.

## Install

Codex scans `~/.agents/skills/` at startup. Install with the AgentSkills.io standard CLI:

```bash
npx skills add andreaserradev-gbj/dev-workflow
```

All seven skills install at once and are managed by `npx skills` (`list`, `update`, `remove`). Restart Codex to discover them.

> **Already using the Claude Code plugin?** The installer detects the agents on your `PATH` and may offer Claude Code as a target. **Decline it** — the marketplace plugin already provides these skills on Claude Code, so installing again gives you every skill twice (once from the plugin, once under `~/.claude/skills/`). This command is for the agents that read `~/.agents/skills/`: Codex, pi, OpenCode, and others.

<details>
<summary>No Node? Standard-tools equivalent (curl + tar)</summary>

```bash
mkdir -p ~/.agents/skills
curl -fsSL https://github.com/andreaserradev-gbj/dev-workflow/archive/refs/heads/main.tar.gz \
  | tar -xz -C ~/.agents/skills --strip-components=4 \
        dev-workflow-main/plugins/dev-workflow/skills
```

</details>

## Available Skills

| Skill | Description |
|-------|-------------|
| `dev-plan` | Plan a new feature with structured PRD documentation |
| `dev-checkpoint` | Save progress and generate a continuation prompt |
| `dev-resume` | Resume work from a previous session checkpoint |
| `dev-review` | Generate an architect-readable PRD-vs-implementation alignment report |
| `dev-wrapup` | Review the conversation for learnings worth keeping |
| `dev-dashboard` | Start the bundled dashboard server and show its URL |
| `dev-wiki` | Generate a cross-project markdown wiki from `.dev/` PRDs |

Codex activates a skill when you mention it by name ("use dev-plan"), when the task matches its description, or when you invoke it explicitly.

## Agent Compatibility

Some skills reference Claude Code subagents via the `Task` tool (e.g. `subagent_type=dev-workflow:prd-researcher`, `…:feature-reporter`). Codex has no equivalent, so those delegation steps are skipped — the skills still provide their full structured workflow (phases, templates, guidance); the research just runs inline instead of via parallel agents. For `dev-plan` the research phase is done inline; for `dev-review` the report structure in the skill body drives an inline review.

The CLI-backed skills (`dev-plan`, `dev-checkpoint`, `dev-resume`, `dev-review`, `dev-wiki`) shell out to a self-contained `node` CLI bundled inside each skill, so Node must be on PATH and Codex must permit the `node` call.

## Manage

```bash
npx skills list      # see installed skills
npx skills update    # update to the latest version
npx skills remove    # remove skills
```

## Getting Help

- Report issues: https://github.com/andreaserradev-gbj/dev-workflow/issues
- Main documentation: https://github.com/andreaserradev-gbj/dev-workflow
