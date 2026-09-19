![Wormular logo](/assets/images/wormular.webp)

# Wormular

A gravitational twist on the classic Snake game!

Navigate around the galaxy, munching on delectable starfruit while avoiding space rocks, the outer void, and the black hole!

**Hold** to move outward.
**Release** and gravity pulls toward the center.

Game modes: Solo, Local 1v1, or Online 1v1

## Play (web)

**Live:** [lwilli.github.io/wormular](https://lwilli.github.io/wormular/)

```bash
npm install
npm run dev
# Phone on same Wi‑Fi: open http://<your-lan-ip>:5173/ (Vite prints Network URL).
# For leaderboard + online PvP: npm run dev:all
```

Hold anywhere (or Space / ↑) to move outward. Release to fall toward the center. Eat apples; avoid rocks, walls, and yourself.

The title screen shows the **starting arena paused**. Swipe or tap the side circles to pick **Solo**, **Local 1v1**, or **Online 1v1** (wraps; selection sticks). **Solo:** Press & Hold to start. **Local:** Tap to Start, then a 5s countdown — hold the **top** (orange) / **bottom** (teal) half of the screen, or Space / W on keyboard. **Online:** Tap to find an opponent — the same center prompt becomes Finding / Waiting / error. Mode selection alone does not launch the run. Solo shows personal high score + leaderboard; Local shows the dual-control brief; Online shows nickname. After a run ends, a **result screen** shows your score (or who won) until you tap to return to the mode selector.

```bash
npm test      # core simulation tests
npm run build # production bundle (GitHub Pages base /wormular/)
npm run preview # serve dist locally
npm run icons # regenerate favicon / app icons from the title W (needs Pillow + numpy)
npm run dev:all # Vite + local leaderboard/PvP API (proxied at /api)
```

**→ [docs/icons.md](docs/icons.md)** — how to regenerate favicons / PWA icons / iOS App Icon from the title-art W.

Set `VITE_API_URL` to your Cloudflare Worker URL for production leaderboard/online play (see `.env.example`). Locally, leave it empty and use `npm run dev:all`.

## Production (leaderboard + online PvP)

GitHub Pages only hosts the static game. The API is a **Cloudflare Worker** (D1 + Durable Objects).

**Live API (this account):** `https://wormular-api.lwilli.workers.dev`  
Smoke-check: `GET /health` → `{"ok":true}`; `GET /scores` → JSON list.

### First-time Cloudflare setup

From `worker/` (scripts use `npx wrangler`, so a local `wrangler` binary on PATH is not required):

```bash
cd worker && npm install
npx wrangler login          # browser OAuth; verify the Cloudflare account email if prompted
```

1. **Create D1** (skip if `database_id` in `wrangler.toml` is already a UUID, not a placeholder):
   ```bash
   npx wrangler d1 create wormular
   ```
   Paste the printed id into `worker/wrangler.toml` → `database_id`.
2. **Apply schema** (remote): `npm run db:init:remote`
3. **Deploy API**: from repo root `npm run worker:deploy` (or `npm run deploy` inside `worker/`).  
   Note the URL, e.g. `https://wormular-api.<subdomain>.workers.dev`.  
   First Workers use may ask you to register a `*.workers.dev` subdomain.
4. **Point the web build at it**: GitHub → Settings → Secrets and variables → Actions → **Repository** secret (not an Environment secret):
   - Name: `VITE_API_URL`
   - Value: Worker URL, no trailing slash  
   The Pages workflow injects this into `npm run build` on pushes to `main`. The `build` job has no `environment:`, so Environment secrets are invisible to it.
5. **Ship the client**: merge to `main` (or push `main`) so Pages redeploys with the baked-in API URL.

`ALLOWED_ORIGINS` in `worker/wrangler.toml` must list every browser origin that calls the Worker (CORS). It already includes local Vite and `https://lwilli.github.io`. Redeploy the Worker after changing it.

### Visits + plays (cookieless)

The API keeps aggregate counters — no cookies, no stored IPs, no third-party script, so no cookie banner.

- Each web load fires `POST /visit`.
- Each started run fires `POST /play?mode=solo|local|online` (online = match start). Entering the online waiting state fires `POST /play?mode=online_queue`.
- Check totals: `curl https://wormular-api.lwilli.workers.dev/stats` → `{"visits":N,"plays":{"solo":N,"local":N,"online":N,"online_queue":N}}`.
- Dashboard: [lwilli.github.io/wormular/stats.html](https://lwilli.github.io/wormular/stats.html) (local: `http://127.0.0.1:5173/stats.html` with `npm run dev:all`).

After pulling schema changes, apply them remotely (`cd worker && npm run db:init:remote`) and redeploy the Worker.

### Pitfalls we hit

- **Email verification** — Cloudflare rejects Worker deploys until the account email is verified ([docs](https://developers.cloudflare.com/fundamentals/setup/account/verify-email-address/)).
- **Free-plan Durable Objects** — migrations must use `new_sqlite_classes` (not `new_classes`) for `MatchRoom`.
- **`wrangler: command not found`** — use the npm scripts (`npx wrangler`); run `npm install` in `worker/` first.
- **Redeploy after Worker code or `ALLOWED_ORIGINS` changes**: `npm run worker:deploy`.
## iOS (Capacitor)

Same web build in a native shell. Bundle id: `com.lwilli.wormular`.

```bash
npm run ios        # build:ios + cap sync + open Xcode
# or stepwise:
npm run build:ios  # Vite build with base /
npm run cap:sync   # copy web assets into ios/
npm run cap:open   # open ios/App/App.xcodeproj
```

**→ [docs/ios.md](docs/ios.md)** — run on a **real iPhone** (signing, Developer Mode, trust cert).

Short version: Apple ID in Xcode → plug in phone → select your Team on the App target → pick the device → Run. Trust the developer cert on the phone if iOS blocks the first launch.

## Design

- **[docs/PLAN.md](docs/PLAN.md)** — stack, architecture, simulation, phases, and non-goals.
- **[docs/controls.md](docs/controls.md)** — physics & juice knobs (danger, swell, shake, FX timings).
- **[docs/icons.md](docs/icons.md)** — favicon / app icon regen from the title W.
- **[docs/adr/0001-capacitor-ios-shell.md](docs/adr/0001-capacitor-ios-shell.md)** — why Capacitor and how the iOS shell is wired.
- **[docs/adr/0002-leaderboard-and-pvp.md](docs/adr/0002-leaderboard-and-pvp.md)** — Cloudflare leaderboard + lockstep PvP.
- **[docs/adr/0003-cookieless-visit-analytics.md](docs/adr/0003-cookieless-visit-analytics.md)** — first-party visit + play counters (no cookies / no banner).
- **[docs/ios.md](docs/ios.md)** — device / simulator runbook.

## Status

Web playable with juice (FX + audio), **global leaderboard**, **local 1v1** (split-touch halves + keyboard), **online 1v1**, **post-game result screens**, and **cookieless visit + play counters** (`GET /stats` on the API). Favicon / web icons and iOS App Icon use the title-art W. Client on GitHub Pages (`main`); API on Cloudflare Worker + D1 + Durable Objects (`wormular-api.lwilli.workers.dev`). Local stack: `npm run dev:all`.

iOS Capacitor shell works on simulator; physical device needs your Apple ID signing (see [docs/ios.md](docs/ios.md)). Store / TestFlight still phase 8.

Design notes: [docs/adr/0002-leaderboard-and-pvp.md](docs/adr/0002-leaderboard-and-pvp.md), [docs/adr/0003-cookieless-visit-analytics.md](docs/adr/0003-cookieless-visit-analytics.md).
