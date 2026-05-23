# dev-workflow for Gemini CLI

Guide for using dev-workflow skills with Google Gemini CLI via native skill discovery.

## Quick Install

One command:

```bash
gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

Or tell Gemini:

```
Run gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

## Manual Installation

### Prerequisites

- Gemini CLI
- Git

### Option A: Clone + Link

1. Clone the repo:
   ```bash
   git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.gemini/dev-workflow
   ```

2. Link the skills:
   ```bash
   gemini skills link ~/.gemini/dev-workflow/plugins/dev-workflow/skills
   ```

3. Verify with `/skills list`.

### Option B: Manual Symlink

1. Clone the repo:
   ```bash
   git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.gemini/dev-workflow
   ```

2. Create the skills symlink:
   ```bash
   mkdir -p ~/.gemini/skills
   ln -s ~/.gemini/dev-workflow/plugins/dev-workflow/skills ~/.gemini/skills/dev-workflow
   ```

3. Restart Gemini CLI.

### Windows

Use a junction instead of a symlink (works without Developer Mode):

```powershell
git clone https://github.com/andreaserradev-gbj/dev-workflow.git "$env:USERPROFILE\.gemini\dev-workflow"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.gemini\skills"
cmd /c mklink /J "$env:USERPROFILE\.gemini\skills\dev-workflow" "$env:USERPROFILE\.gemini\dev-workflow\plugins\dev-workflow\skills"
```

## How It Works

Gemini CLI has multi-tier skill discovery -- it scans for skills across workspace, user, and extension locations. dev-workflow skills are standard AgentSkills.io format, so they work with any of these discovery methods:

- **`gemini skills install`** — downloads and registers skills from a git repository
- **`gemini skills link`** — registers a local directory as a skill source
- **Manual symlink** — place skills in Gemini's skill discovery path

Each skill directory contains a `SKILL.md` with YAML frontmatter (`name`, `description`) that Gemini uses for discovery and activation.

## Available Skills

| Skill | Description |
|-------|-------------|
| `dev-plan` | Plan a new feature with structured PRD documentation |
| `dev-checkpoint` | Save progress and generate a continuation prompt |
| `dev-resume` | Resume work from a previous session checkpoint |
| `dev-quiz` | Critique a feature plan against a fixed rubric and emit a `<verdict>` block |
| `dev-judge` | Critique a completed phase's diff against acceptance criteria and emit a `<verdict>` block |
| `dev-wrapup` | Review the conversation for learnings worth keeping |
| `dev-dashboard` | Start the bundled dashboard server and show its URL |
| `dev-wiki` | Generate a cross-project markdown wiki from `.dev/` PRDs |

### Usage

After installation, verify skills are available:

```
/skills list
```

To reload skills after updates:

```
/skills reload
```

Skills are discovered automatically. Gemini activates them when:
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

**dev-quiz:**
```
use dev-quiz to grill the oauth-login plan
critique my latest PRD
```

**dev-judge:**
```
use dev-judge on the phase I just finished
review the diff against the sub-PRD
```

### Workflow

The intended workflow is: **plan -> build -> checkpoint -> resume -> build -> checkpoint -> resume** ... until the feature is complete. See the [main README](../README.md) for a detailed explanation.

## Agent Compatibility

Some skills reference Claude Code subagents via the `Task` tool (e.g., `subagent_type=dev-workflow:prd-researcher`, `subagent_type=dev-workflow:phase-reviewer`). Gemini CLI doesn't have this mechanism, so agent delegation steps will be skipped. The skills still provide structured workflow instructions -- phases, templates, rubrics, and guidance all work -- but parallel agent research and the `dev-judge` reviewer agent won't execute. For `dev-plan`, the research phase needs to be done manually or through direct prompting instead. For `dev-judge`, the rubric in the skill body is enough to drive an inline critique.

## AFK Mode (Claude Code only)

The `/dev-afk` skill loops a feature's pending phases inside a Claude Code session by composing `/dev-resume`, `/dev-checkpoint`, and `/dev-judge` and handing the loop to the [`ralph-loop` plugin](https://github.com/anthropics/claude-plugins-official). It depends on Claude Code's slash-command and Stop-hook machinery, so it does not run under Gemini CLI. The companion `dev-workflow list` command just reads `.dev/` folders and works regardless of which agent you use.

## Updating

**`gemini skills install` users:** re-run the install command:
```bash
gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

**Clone + link / manual symlink users:**
```bash
cd ~/.gemini/dev-workflow && git pull
```

After updating, run `/skills reload` in Gemini CLI to refresh the skill catalog.

## Uninstalling

**`gemini skills install` users:** uninstall each skill individually:
```bash
gemini skills uninstall dev-plan
gemini skills uninstall dev-checkpoint
gemini skills uninstall dev-resume
gemini skills uninstall dev-quiz
gemini skills uninstall dev-judge
gemini skills uninstall dev-wrapup
gemini skills uninstall dev-dashboard
```

**Clone + link / manual symlink users:**
```bash
rm ~/.gemini/skills/dev-workflow
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.gemini\skills\dev-workflow"
```

Optionally delete the clone: `rm -rf ~/.gemini/dev-workflow` (Windows: `Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\dev-workflow"`).

## Troubleshooting

### Skills not showing up

1. Run `/skills list` to check registered skills
2. Run `/skills reload` to re-scan skill directories
3. Verify the installation: check that skill files exist at the expected path
4. Restart Gemini CLI -- some changes require a restart

### Windows junction issues

Junctions normally work without special permissions. If creation fails, try running PowerShell as administrator.

## Getting Help

- Report issues: https://github.com/andreaserradev-gbj/dev-workflow/issues
- Main documentation: https://github.com/andreaserradev-gbj/dev-workflow
