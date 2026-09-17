# ADR 0002: Global leaderboard + lockstep PvP on Cloudflare

## Status

Accepted

## Context

Wormular is a free, static GitHub Pages game with a pure, fixed-timestep, seedable core and no backend. We want:

1. A **global leaderboard** (nickname + score).
2. **Live online 1v1** (opposite starts, two apples, first death loses).

Costs must stay near $0.

## Decision

### Leaderboard

- **Cloudflare Worker** HTTP API: `GET/POST /scores`
- **Cloudflare D1** for score rows
- Client submits final run score with a nickname (soft trust; ~3s per-IP rate limit so short arcade runs can post)
- Local high score remains in `localStorage` / Preferences

### PvP

- Extend core with `BattleWorld` (two worms, two apples, head-vs-opponent-body death)
- **Input lockstep** over WebSockets: clients run the same seeded sim; server only relays ordered inputs
- **Cloudflare Durable Object** (`MatchRoom`) for matchmaking + input relay
- Local 1v1 (top half / Space vs bottom half / W, with orange/teal zone chrome) ships without a network

### Local development

- `scripts/dev-api.mjs` mirrors the Worker API in-memory
- Vite proxies `/api` → `http://127.0.0.1:8787`
- `npm run dev:all` runs both

## Consequences

- No player accounts / OAuth in v1 — nicknames only
- Leaderboard scores are cheatable; acceptable for casual free play
- PvP desync risk is mitigated by deterministic `FIXED_DT` + shared seed; reconnect = forfeit
- Production needs a deployed Worker URL in `VITE_API_URL` as a **repository** Actions secret (Pages `build` job; not an Environment secret). Runbook: [README.md](../../README.md#production-leaderboard--online-pvp)
- Worker CORS is an allowlist (`ALLOWED_ORIGINS` in `worker/wrangler.toml`); Pages origin must be listed and the Worker redeployed after edits
- Free-plan Durable Objects require `new_sqlite_classes` in wrangler migrations (not `new_classes`)
- Clients send `{ type: 'finish' }` before closing so a normal death is not treated as a disconnect forfeit
- Online clients mirror the full arena so each player sees themselves as orange; match countdown + input pipelining keep lockstep playable at uneven FPS
- Free-tier Cloudflare is enough for hobby traffic; cost is mostly engineering time

## Alternatives considered

- Firebase / Supabase — heavier; another vendor
- Authoritative physics server — duplicates core, costs more CPU
- WebRTC P2P — NAT/mobile pain; worse for a first cut
- Game Center only — iOS-only; web still needs its own board
