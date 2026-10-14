# Security Policy

This repo ships AI-agent skills that read project files and execute workflows.
That shape is inherently attractive to skills.sh's static scanners; this document
states the actual trust boundaries so findings can be judged against intent.

## Trust model

| Input | Trust level | Handling |
|---|---|---|
| `.dev/**` PRD, checkpoint, wiki markdown | **Untrusted data** — authored by agents exposed to untrusted repos, web research, and PR content | Parsed, never followed as instructions; skills instruct the agent to treat scanned content as data. Rendered to the dashboard only after DOMPurify sanitization |
| Dashboard API traffic | Local-only (127.0.0.1 server) | Same markdown sanitization as above for any rendered field |
| External processes (open/archive/restore) | Discrete enum + URL params from client; server resolves paths from project state | `execFile` with an arg array — never `exec`, never `{ shell: true }` |
| Bundled artifacts (`bin/dev-workflow.cjs`, `dashboard/`, `tui/cli.mjs`) | Committed build products of this repo | Built unminified (readable, diffable — minified bundles are what skills.sh flags as OBFUSCATION); esbuild build step strips scanner-visible but unreachable dynamic-code primitives (gray-matter JS engine, js-yaml `!!js/function`), with guarded replacements that fail the build if dependency internals move |

## Scanner categories on shipped skills — expected, not incidental

- `INDIRECT_PROMPT_INJECTION` — every skill indexes `.dev/` markdown; mitigated
  by data/instruction boundary rules in each skill, not by code alone.
- `EXTERNAL_DOWNLOADS` (dev-plan) — research sub-agents fetch docs by design.
- `COMMAND_EXECUTION` — the skills drive workflows (worktrees, dashboard server,
  release scripts); all process launches use arg-array `execFile`.

Residual MEDIUMs on these categories are the scanners correctly describing the
product's surface; they do not indicate a fixable code defect. The remediation
history (PRs referenced in CHANGELOG.md `Unreleased`) documents each shipped
change: markdown sanitization, unminified bundles, and the stale-finding gate
exclusion.

## Reporting

Security issues: open a GitHub issue on this repo, or contact Vercel
(security.vercel.com) for skills.sh scan-content problems.