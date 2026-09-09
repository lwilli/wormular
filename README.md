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

Requirements: Xcode with the matching **iOS platform** installed (Settings → Components). Pick a simulator or device, then Run.

High scores use Capacitor Preferences on device and `localStorage` on web.

## Design

**→ [docs/PLAN.md](docs/PLAN.md)** — stack, architecture, simulation, phases, and non-goals.

## Status

v1 web playable with audio juice (eat/crash SFX, BGM, mute toggle). Deployed to GitHub Pages on push to `main`.

iOS Capacitor shell is scaffolded (`ios/`); open in Xcode to run on simulator/device. Store icons / TestFlight are still later (plan phase 8).
