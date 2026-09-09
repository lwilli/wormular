# Wormular

One-tap arcade game: Snake meets the gravity helicopter game, played in a circular arena.

**Hold** to thrust outward. **Release** and gravity pulls toward the center. Eat apples, grow, avoid rocks.

## Play (web)

**Live:** [lwilli.github.io/wormular](https://lwilli.github.io/wormular/)

```bash
npm install
npm run dev
```

Hold anywhere (or Space / ↑) to thrust outward. Release to fall toward the center. Eat apples; avoid rocks, walls, and yourself.

```bash
npm test      # core simulation tests
npm run build # production bundle (GitHub Pages base /wormular/)
npm run preview # serve dist locally
```

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
- **[docs/adr/0001-capacitor-ios-shell.md](docs/adr/0001-capacitor-ios-shell.md)** — why Capacitor and how the iOS shell is wired.
- **[docs/ios.md](docs/ios.md)** — device / simulator runbook.

## Status

v1 web playable with juice (FX + audio). Deployed to GitHub Pages on push to `main`.

iOS Capacitor shell works on simulator; physical device needs your Apple ID signing (see [docs/ios.md](docs/ios.md)). Store / TestFlight still phase 8.
