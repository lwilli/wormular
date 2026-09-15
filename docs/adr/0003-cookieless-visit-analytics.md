# ADR 0003: Cookieless first-party visit counter

## Status

Accepted

## Context

We want a rough sense of how many people open the web game. Third-party analytics (GA, etc.) usually need cookies or fingerprinting and trigger cookie banners. We already run a Cloudflare Worker + D1 for the leaderboard.

## Decision

- **First-party only**: `POST /visit` on the existing Wormular API increments a single D1 counter (`counters.visits`).
- **`GET /stats`** returns `{ visits }` for humans (`curl`).
- Client fires one `fetch(..., { keepalive: true })` on boot — no cookies, no `localStorage`, no third-party script.
- IP is used only for a short in-memory rate limit (same pattern as score submit) and is **never stored**.

No cookie banner: this is an aggregate server-side hit count with no identifiers persisted.

## Consequences

- After schema change: `cd worker && npm run db:init:remote` then redeploy the Worker.
- Counts are soft (refresh = another visit; rate limit drops rapid repeats).
- Not a full analytics product (no referrers, funnels, or unique users).

## Alternatives considered

- Google Analytics / similar — cookie consent, third-party
- Cloudflare Web Analytics — cookieless but another dashboard/token
- Plausible / Umami — good, but extra service for one number
