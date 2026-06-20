# Installing dev-workflow for Codex

Codex discovers skills from `~/.agents/skills/`. Install with the AgentSkills.io standard CLI:

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

## Manage

```bash
npx skills list      # see installed skills
npx skills update    # update to the latest version
npx skills remove    # remove skills
```
