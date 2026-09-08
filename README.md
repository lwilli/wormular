# Wormular

One-tap arcade game: Snake meets the gravity helicopter game, played in a circular arena.

**Hold** to thrust outward. **Release** and gravity pulls toward the center. Eat apples, grow, avoid rocks.

## Status

Foundation plan only — no game code yet. Implementation should follow the handoff spec:

**→ [docs/PLAN.md](docs/PLAN.md)**

That document covers product, tech stack, architecture, simulation, rendering, screens, phases, and non-goals.

## How this repo will be built

1. **TypeScript + Vite + HTML Canvas** — pure simulation core, procedural vector art, no game engine.
2. **Web first** — playable in the browser, then wrapped with Capacitor for iOS (and Android later).
3. **v1** — core, canvas play, title + high score (silent, no VFX).
4. **Later** — subtle eat/death juice + sounds, then native shells and store assets.

See [docs/PLAN.md](docs/PLAN.md) for the full phase order and quality bar.
