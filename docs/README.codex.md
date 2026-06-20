# dev-workflow for Codex

Use dev-workflow skills with OpenAI Codex via native skill discovery.

## Install

Codex scans `~/.agents/skills/` at startup. One command installs all seven skills — no clone, no symlink:

```bash
npx degit andreaserradev-gbj/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
```

<details>
<summary>No Node? Standard-tools equivalent (curl + tar)</summary>

```bash
mkdir -p ~/.agents/skills/dev-workflow
curl -fsSL https://github.com/andreaserradev-gbj/dev-workflow/archive/refs/heads/main.tar.gz \
  | tar -xz -C ~/.agents/skills/dev-workflow --strip-components=4 \
        dev-workflow-main/plugins/dev-workflow/skills
```

</details>

Restart Codex to discover the skills. Pin a version by appending a tag: `…/skills#v1.36.0`.

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

## Update

```bash
npx degit --force andreaserradev-gbj/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
```

## Uninstall

```bash
rm -rf ~/.agents/skills/dev-workflow
```

## Getting Help

- Report issues: https://github.com/andreaserradev-gbj/dev-workflow/issues
- Main documentation: https://github.com/andreaserradev-gbj/dev-workflow
