# Installing dev-workflow for Codex

Enable dev-workflow skills in Codex via native skill discovery. Just clone and symlink.

## Prerequisites

- Git

## Installation

1. **Clone the dev-workflow repository:**
   ```bash
   git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.codex/dev-workflow
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\dev-workflow" "$env:USERPROFILE\.codex\dev-workflow\plugins\dev-workflow\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## Verify

```bash
ls -la ~/.agents/skills/dev-workflow
```

You should see a symlink (or junction on Windows) pointing to your dev-workflow skills directory.

## Updating

```bash
cd ~/.codex/dev-workflow && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/dev-workflow
```

Optionally delete the clone: `rm -rf ~/.codex/dev-workflow`.
