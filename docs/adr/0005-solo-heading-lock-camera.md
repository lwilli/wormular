# ADR 0005: Solo heading-lock camera (prototype)

## Status

Prototype — solo only. Local / Online 1v1 keep fixed world axes.

## Context

In polar crawl games, the worm orbits the center while the camera usually stays world-fixed, so the head travels around the disk. A common sidescroller trick is to pin the player on screen and scroll the world. For Wormular that means pinning the head at **12 o’clock** and rotating the arena under it so crawl feels like forward motion.

## Decision

- **Simulation unchanged** — still polar `r` / `θ` in `src/core`. No camera state in the world.
- **Solo render only** — `drawWorld` applies `ctx.rotate(-π/2 - worm.theta)` after centering / shake so the head maps to canvas `(0, -r)` (12 o’clock; canvas `+y` down). Rocks, apple, body, ocean, vortex, and FX rotate with that transform.
- **Battle unchanged** — `drawBattleWorld` keeps absolute axes (plus the existing online `viewAs === 1` seat mirror).
- Helper: `soloHeadingLockRotation(theta)` in `src/render/draw.ts` for the angle (and a unit test).

Title / peek / play / death / result all use `drawWorld` for solo, so the head sits at 12 o’clock whenever solo is shown.

## Consequences

- Thrust / gravity still move the head along the vertical ray (farther from / closer to the core); only angular screen motion is cancelled.
- Full-viewport `drawSpace` stays unrotated (drawn before the arena transform); the disk contents spin against that backdrop.
- If this feel ships, Local/Online would need a per-seat policy (whose head locks?) — deferred.

## Alternatives considered

- Translate-only follow (pan with head, no rotate) — keeps world upright but loses the “crawling forward” illusion on a disk.
- Rotate sim coordinates each tick — couples camera to physics and breaks battle / net sync assumptions.
- Opt-in flag per draw call — unnecessary while the prototype is solo-global inside `drawWorld`.
