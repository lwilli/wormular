# Wormular

One-tap arcade game: Snake meets the gravity helicopter game, played in a circular arena.

**Hold** to thrust outward. **Release** and gravity pulls toward the center. Eat apples, grow, avoid rocks.

## Play (web)

```bash
npm install
npm run dev
```

Hold anywhere (or Space / ↑) to thrust outward. Release to fall toward the center. Eat apples; avoid rocks, walls, and yourself.

```bash
npm test      # core simulation tests
npm run build # production bundle
```

## Design

**→ [docs/PLAN.md](docs/PLAN.md)** — stack, architecture, simulation, phases, and non-goals.

## Status

v1 web playable: core + canvas + title/high score. Silent (no VFX/audio yet — juice is phase 4).
