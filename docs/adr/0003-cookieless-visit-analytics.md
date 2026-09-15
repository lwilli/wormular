# ADR 0003: Cookieless first-party visit + play counters

## Status

Accepted

## Context

We want a rough sense of how many people open the web game and how often each mode is played. Third-party analytics (GA, etc.) usually need cookies or fingerprinting and trigger cookie banners. We already run a Cloudflare Worker + D1 for the leaderboard.

## Decision

- **First-party only** on the existing Wormular API:
  - `POST /visit` increments `counters.visits`
  - `POST /play?mode=solo|local|online|online_queue` increments `counters.plays_*`
  - `GET /stats` returns `{ visits, plays: { solo, local, online, online_queue } }`
- Client fires keepalive `fetch` on boot (visit) and when a run actually starts (play) — no cookies, no `localStorage`, no third-party script.
- A static `public/stats.html` dashboard polls `GET /stats` (noindex; not part of the game UI).
- Online plays are counted when a match starts. `online_queue` counts each time a player enters the waiting state. Each client counts once per event (~2 online plays per match).
- IP is used only for a short in-memory rate limit (same pattern as score submit) and is **never stored**.

No cookie banner: aggregate server-side counters with no identifiers persisted. Unique/day hashing is intentionally out of scope.

## Consequences

- After schema change: apply remote D1 init, then redeploy the Worker.
- Counts are soft (refresh = another visit; rapid repeats may be rate-limited).
- Not a full analytics product (no referrers, funnels, or unique users).

## Alternatives considered

- Google Analytics / similar — cookie consent, third-party
- Cloudflare Web Analytics — cookieless but another dashboard/token
- Plausible / Umami — good, but extra service for a few numbers
- Approximate unique/day via rotating IP hash — more complexity; skipped for now
