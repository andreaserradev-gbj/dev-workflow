## Session 1 — 2026-04-10T09:00:00.000Z

<context>
Phase 1 planning. Set up project structure and dependencies.
</context>

<decisions>
- Use REST API
- Skip GraphQL
</decisions>

<notes>
- Token expiry edge case
</notes>

---

## Session 2 — 2026-04-11T14:00:00.000Z

<context>
Implementing auth middleware and token service.
</context>

<decisions>
- Use JWT
</decisions>

<blockers>
- Waiting on Redis
</blockers>

---

## Session 3 — 2026-04-12T10:00:00.000Z

<context>
Phase 1 complete. Moving to Phase 2.
</context>

<decisions>
- Use RS256
- Cache tokens
</decisions>

<notes>
- Watch for clock skew
</notes>

---