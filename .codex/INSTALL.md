# Installing dev-workflow for Codex

Codex discovers skills from `~/.agents/skills/`. One command installs all seven — no clone, no symlink.

## Install

```bash
npx degit andreaserradev-gbj/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
```

Restart Codex (quit and relaunch) to discover the skills. Pin a version instead of latest by appending a tag: `…/skills#v1.36.0`.

<details>
<summary>No Node? Standard-tools equivalent (curl + tar)</summary>

```bash
mkdir -p ~/.agents/skills/dev-workflow
curl -fsSL https://github.com/andreaserradev-gbj/dev-workflow/archive/refs/heads/main.tar.gz \
  | tar -xz -C ~/.agents/skills/dev-workflow --strip-components=4 \
        dev-workflow-main/plugins/dev-workflow/skills
```

</details>

## Verify

```bash
ls ~/.agents/skills/dev-workflow
```

You should see the seven skill directories (`dev-plan`, `dev-checkpoint`, `dev-resume`, `dev-review`, `dev-wiki`, `dev-wrapup`, `dev-dashboard`).

## Update

Re-run the install with `--force`:

```bash
npx degit --force andreaserradev-gbj/dev-workflow/plugins/dev-workflow/skills ~/.agents/skills/dev-workflow
```

## Uninstall

```bash
rm -rf ~/.agents/skills/dev-workflow
```
