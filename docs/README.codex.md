# dev-workflow for Codex

Guide for using dev-workflow skills with OpenAI Codex via native skill discovery.

## Quick Install

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/andreaserradev-gbj/dev-workflow/refs/heads/main/.codex/INSTALL.md
```

## Manual Installation

### Prerequisites

- OpenAI Codex CLI
- Git

### Steps

1. Clone the repo:
   ```bash
   git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.codex/dev-workflow
   ```

2. Create the skills symlink:
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
   ```

3. Restart Codex.

### Windows

Use a junction instead of a symlink (works without Developer Mode):

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\dev-workflow" "$env:USERPROFILE\.codex\dev-workflow\plugins\dev-workflow\skills"
```

## How It Works

Codex has native skill discovery -- it scans `~/.agents/skills/` at startup, parses SKILL.md frontmatter, and loads skills on demand. dev-workflow skills are made visible through a single symlink:

```
~/.agents/skills/dev-workflow/ -> ~/.codex/dev-workflow/plugins/dev-workflow/skills/
```

Each skill directory contains a `SKILL.md` with YAML frontmatter (`name`, `description`) that Codex uses for discovery and activation.

## Available Skills

| Skill | Description |
|-------|-------------|
| `dev-plan` | Plan a new feature with structured PRD documentation |
| `dev-checkpoint` | Save progress and generate a continuation prompt |
| `dev-resume` | Resume work from a previous session checkpoint |
| `dev-status` | Show status of all features and offer to archive completed ones |

### Usage

Skills are discovered automatically. Codex activates them when:
- You mention a skill by name (e.g., "use dev-plan")
- The task matches a skill's description
- You explicitly invoke a skill

### Examples

**dev-plan:**
```
use dev-plan to add OAuth login with Google and GitHub providers
plan a feature: refactor the database layer to use connection pooling
```

**dev-checkpoint:**
```
use dev-checkpoint to save progress on oauth-login
save a checkpoint
```

**dev-resume:**
```
use dev-resume to pick up where I left off on oauth-login
resume my previous session
```

**dev-status:**
```
use dev-status to check progress across all features
show dev status
```

### Workflow

The intended workflow is: **plan -> build -> checkpoint -> resume -> build -> checkpoint -> resume** ... until the feature is complete. See the [main README](../README.md) for a detailed explanation.

## Agent Compatibility

Some skills reference Claude Code subagents via the `Task` tool (e.g., `subagent_type=dev-workflow:prd-researcher`). Codex doesn't have this mechanism, so agent delegation steps will be skipped. The skills still provide structured workflow instructions -- phases, templates, and guidance all work -- but parallel agent research won't execute. This has minimal impact on `dev-checkpoint`, `dev-resume`, and `dev-status`. For `dev-plan`, the research phase will need to be done manually or through direct prompting instead of agent delegation.

## Updating

```bash
cd ~/.codex/dev-workflow && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/dev-workflow
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.agents\skills\dev-workflow"
```

Optionally delete the clone: `rm -rf ~/.codex/dev-workflow` (Windows: `Remove-Item -Recurse -Force "$env:USERPROFILE\.codex\dev-workflow"`).

## Troubleshooting

### Skills not showing up

1. Verify the symlink: `ls -la ~/.agents/skills/dev-workflow`
2. Check skills exist: `ls ~/.codex/dev-workflow/plugins/dev-workflow/skills`
3. Restart Codex -- skills are discovered at startup

### Windows junction issues

Junctions normally work without special permissions. If creation fails, try running PowerShell as administrator.

## Getting Help

- Report issues: https://github.com/andreaserradev-gbj/dev-workflow/issues
- Main documentation: https://github.com/andreaserradev-gbj/dev-workflow
