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
npm run build # production bundle
npm run preview # serve dist locally (uses /wormular/ base path)
```

## Design

**→ [docs/PLAN.md](docs/PLAN.md)** — stack, architecture, simulation, phases, and non-goals.

## Status

v1 web playable with audio juice (eat/crash SFX, BGM, mute toggle). Deployed to GitHub Pages on push to `main`.
