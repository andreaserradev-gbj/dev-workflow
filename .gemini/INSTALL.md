# Installing dev-workflow for Gemini CLI

Enable dev-workflow skills in Gemini CLI. Three installation options below.

## Prerequisites

- Git
- Gemini CLI

## Installation

### Option A: Direct Install (recommended)

```bash
gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

### Option B: Clone + Link (for development)

```bash
git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.gemini/dev-workflow
gemini skills link ~/.gemini/dev-workflow/plugins/dev-workflow/skills
```

### Option C: Manual Symlink

```bash
git clone https://github.com/andreaserradev-gbj/dev-workflow.git ~/.gemini/dev-workflow
mkdir -p ~/.gemini/skills
ln -s ~/.gemini/dev-workflow/plugins/dev-workflow/skills ~/.gemini/skills/dev-workflow
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/andreaserradev-gbj/dev-workflow.git "$env:USERPROFILE\.gemini\dev-workflow"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.gemini\skills"
cmd /c mklink /J "$env:USERPROFILE\.gemini\skills\dev-workflow" "$env:USERPROFILE\.gemini\dev-workflow\plugins\dev-workflow\skills"
```

## Verify

```
/skills list
```

You should see `dev-plan`, `dev-checkpoint`, `dev-resume`, and `dev-status` in the output.

## Updating

**Option A installs:** re-run the install command:
```bash
gemini skills install https://github.com/andreaserradev-gbj/dev-workflow.git --path plugins/dev-workflow/skills
```

**Option B/C installs:**
```bash
cd ~/.gemini/dev-workflow && git pull
```

After updating, run `/skills reload` in Gemini CLI to refresh the skill catalog.

## Uninstalling

**Option A installs:** uninstall each skill individually:
```bash
gemini skills uninstall dev-plan
gemini skills uninstall dev-checkpoint
gemini skills uninstall dev-resume
gemini skills uninstall dev-status
```

**Option B/C installs:**
```bash
rm ~/.gemini/skills/dev-workflow
```

Optionally delete the clone: `rm -rf ~/.gemini/dev-workflow`.
