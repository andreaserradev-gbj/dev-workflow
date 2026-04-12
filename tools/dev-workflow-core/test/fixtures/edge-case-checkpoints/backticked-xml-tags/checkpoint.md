---
branch: feature/test
last_commit: abc123 add XML section handler
uncommitted_changes: false
checkpointed: 2026-04-01T14:00:00Z
---

Read the following PRD files in order:

1. .dev/test-feature/00-master-plan.md

<next_action>
## Next Steps

Phase 1 — Writer Core:
1. Create writer with `writeCheckpoint()` using `matter.stringify()`.
2. Handle optional sections: omit `<decisions>`, `<blockers>`, `<notes>` when empty.
3. Add types and export from index.
</next_action>

<key_files>
## Key Files

- Writer: src/writer.ts
- Parser: src/parser.ts
</key_files>

<decisions>
- Use gray-matter for YAML stringifying
- Round-trip validation only
</decisions>

<notes>
- This PRD mentions `<decisions>` and `<notes>` in backtick code
</notes>

---

Please continue with Phase 1 implementation.