# ADR 0004: Live Online 1v1 lobby presence count

## Status

Accepted

## Context

When Online 1v1 is selected on the title screen, players should see how many people are currently in that lobby (browsing Online, queued, or in a match). Aggregate `GET /stats` play counters are lifetime totals, not concurrent presence.

## Decision

- A dedicated Cloudflare Durable Object (`Presence`, `idFromName("lobby")`) holds open WebSockets from clients with Online 1v1 selected.
- Client connects to `/ws/presence` while that mode is active and disconnects when switching away.
- The DO broadcasts `{ type: 'presence', online: N }` on join/leave (N includes the local player).
- Local `scripts/dev-api.mjs` mirrors the same WebSocket endpoint.
- UI: status line above the Online nickname field (`#panel-online`), just below the arena.

No cookies, no stored session IDs — count is live connection count only.

## Consequences

- Redeploy the Worker after this change so migration `v2` registers the `Presence` class (`new_sqlite_classes`).
- Capacitator / GitHub Pages clients need the updated Worker URL already configured via `VITE_API_URL`.
- If the presence socket drops, the UI shows an em dash and retries after a short delay.

## Alternatives considered

- D1 heartbeats with opaque session IDs — works, but persists ephemeral rows and needs TTL cleanup.
- Reusing `MatchRoom` — that DO is for lockstep matchmaking; mixing lobby presence would couple unrelated lifetimes.
- Showing `plays.online_queue` from `/stats` — cumulative, not “now.”
