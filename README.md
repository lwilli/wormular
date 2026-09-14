# Wormular

One-tap arcade game: Snake meets the gravity helicopter game, played in a circular arena.

**Hold** to move outward. **Release** and gravity pulls toward the center. Eat apples, grow, avoid rocks.

## Play (web)

**Live:** [lwilli.github.io/wormular](https://lwilli.github.io/wormular/)

```bash
npm install
npm run dev
```

Hold anywhere (or Space / ↑) to move outward. Release to fall toward the center. Eat apples; avoid rocks, walls, and yourself.

The title screen shows the **starting arena paused**. Pick **Solo**, **Local 1v1**, or **Online 1v1** (selection sticks), then **Press & Hold** to start that mode — mode tabs only select; they do not launch the run.

```bash
npm test      # core simulation tests
npm run build # production bundle (GitHub Pages base /wormular/)
npm run preview # serve dist locally
npm run dev:all # Vite + local leaderboard/PvP API (proxied at /api)
```

Set `VITE_API_URL` to your Cloudflare Worker URL for production leaderboard/online play (see `.env.example`). Locally, leave it empty and use `npm run dev:all`.

## Production (leaderboard + online PvP)

GitHub Pages only hosts the static game. The API is a **Cloudflare Worker** (D1 + Durable Objects).

1. **Cloudflare login** (once): `cd worker && npx wrangler login`
2. **Create D1** and paste the real id into `worker/wrangler.toml` → `database_id`:
   ```bash
   cd worker && npx wrangler d1 create wormular
   ```
3. **Apply schema** (remote): `npm run db:init:remote` (from `worker/`)
4. **Deploy API**: from repo root `npm run worker:deploy`  
   Note the URL, e.g. `https://wormular-api.<account>.workers.dev`
5. **Point the web build at it**: GitHub repo → Settings → Secrets → Actions → add `VITE_API_URL` = that Worker URL (no trailing slash). The Pages workflow passes it into `npm run build`.
6. **Ship the client**: merge this branch to `main` (or push `main`) so Pages redeploys.

`ALLOWED_ORIGINS` in `worker/wrangler.toml` already includes `https://lwilli.github.io`. Add more origins there if you use another host.

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
- **[docs/adr/0001-capacitor-ios-shell.md](docs/adr/0001-capacitor-ios-shell.md)** — why Capacitor and how the iOS shell is wired.
- **[docs/adr/0002-leaderboard-and-pvp.md](docs/adr/0002-leaderboard-and-pvp.md)** — Cloudflare leaderboard + lockstep PvP.
- **[docs/ios.md](docs/ios.md)** — device / simulator runbook.

## Status

Web playable with juice (FX + audio), **global leaderboard**, **local 1v1**, and **online 1v1** (Cloudflare Workers + D1 + Durable Objects; local API via `npm run dev:all`). Deployed to GitHub Pages on push to `main`.

iOS Capacitor shell works on simulator; physical device needs your Apple ID signing (see [docs/ios.md](docs/ios.md)). Store / TestFlight still phase 8.

Design notes: [docs/adr/0002-leaderboard-and-pvp.md](docs/adr/0002-leaderboard-and-pvp.md).
