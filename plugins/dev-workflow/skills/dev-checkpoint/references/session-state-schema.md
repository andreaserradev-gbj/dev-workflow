# Session State Schema

## File Location
`.dev/<feature>/session-state.json`

## Schema
```json
{
  "status": "active" | "gate" | "idle",
  "phase": <number | null>,
  "gate_label": <string | null>,
  "since": "<ISO 8601 timestamp>"
}
```

## Field Definitions
- **status**: Current session state
  - `active` — session running, implementation in progress
  - `gate` — session hit a phase gate, waiting for user input
  - `idle` — session ended normally
- **phase**: Current phase number (set when status is "gate", null otherwise)
- **gate_label**: The gate prompt text (set when status is "gate", null otherwise)
- **since**: ISO 8601 timestamp of when this state was entered

## Staleness Detection
No PID tracking. Consumers use the `since` timestamp to detect stale sessions:
- If `status` is `"active"` and `since` is older than 30 minutes → treat as stale (session likely crashed or was closed without writing "idle")
- If `status` is `"gate"` → never stale (gates can legitimately wait hours or days)
- If `status` is `"idle"` → not relevant (session already ended)

## Write Points
- **dev-resume**: writes "active" on session start, "gate" at each phase gate
- **dev-checkpoint**: writes "idle" after checkpoint.md is saved
- **dev-wrapup**: writes "idle" after session wrapup completes

## Consumers
- **dev-dashboard**: watches this file via chokidar for live updates
- **dev-board**: reads at generation time for more accurate status badges (gate, building)
- **dev-status**: reads for terminal status output (gate, active session indicators)
- **dev-resume**: producer only (overwrites on start, no read needed)
- All consumers fall back to markdown heuristics when this file doesn't exist
