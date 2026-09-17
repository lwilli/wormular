# Controls — physics & juice knobs

Simple map of where to tweak feel. Most gameplay numbers live as fractions of arena radius **R** in `src/core/config.ts`. Visual-only danger/swell/shake does **not** change collision.

## Physics — `src/core/config.ts`

| Knob | Default | What it does |
|------|---------|--------------|
| `CORE_RADIUS_FRAC` | `0.12` | Lethal black-hole radius (`RCore`) |
| `SPEED_FRAC` | `0.35` | Base tangential speed |
| `SPEED_PER_APPLE_FRAC` | `0.012` | Extra speed per apple |
| `THRUST_FRAC` | `1.8` | Outward accel while holding |
| `GRAVITY_FRAC` | `1.4` | Inward accel when released |
| `DRAG` | `2.2` | Radial velocity damping (not × R) |
| `WORM_THICKNESS_FRAC` | `0.028` | Body / collision thickness |
| `BASE_LENGTH_FRAC` | `0.35` | Starting trail length |
| `LENGTH_PER_APPLE_FRAC` | `0.12` | Growth per apple |
| `POINT_SPACING_PX` | `3` | Trail sample spacing |
| `NECK_THICKNESSES` | `2` | Self-hit grace behind head (× thickness) |
| `APPLE_RADIUS_FRAC` | `0.035` | Food size |
| `ROCK_MIN_FRAC` / `ROCK_MAX_FRAC` | `0.04` / `0.07` | Hazard size range |
| `START_ROCK_COUNT` | `2` | Rocks at start |
| `MAX_ROCKS` | `12` | Rock cap |
| `ROCK_SPAWN_CHANCE` | `0.35` | Chance of a new rock after eat (score ≥ 3) |
| `ROCK_SPAWN_MAX_GAP` | `3` | Force a rock if this many points pass without one |
| `SPAWN_EDGE_MARGIN_FRAC` | `0.06` | Spawn clearance from core / wall |
| `START_RADIUS_FRAC` | `0.55` | Spawn radius (title shows this paused) |
| `START_THETA` | `0` | Launch heading |
| `ROCK_SPAWN_CLEAR_ARC` | `π` | No rocks in this forward arc from worm heading (solo) |
| `BATTLE_START_CLEAR_ARC` | `0.55π` | Per-worm forward clear arc for 1v1 initial rocks |
| `ARENA_PADDING_PX` | `24` | Viewport inset to arena rim |
| `ARENA_PADDING_NARROW_PX` | `12` | Narrow-phone inset |
| `ARENA_NARROW_SIDE_PX` | `400` | When to use narrow padding |
| `FIXED_DT` | `1/60` | Physics step |
| `PRE_BATTLE_COUNTDOWN_MS` | `5000` | Local / Online 1v1 countdown before play |
| `TITLE_RESTART_COOLDOWN_MS` | `700` | Ignore restart right after death |
| `TITLE_DIM` | `0.14` | Canvas darken on title / end of death fade |

Motion math: `src/core/worm.ts`. Hits: `src/core/collide.ts` (center = `r - half ≤ RCore`, wall = `r + half ≥ R`).

## Outer wall danger — `src/render/cosmic.ts`

Visual only. Wired in `src/render/draw.ts` via `wallDanger` → `voidShake` + boundary draw + worm glow.

| Knob | Where | Default | What it does |
|------|-------|---------|--------------|
| Danger start | `wallDanger` → `R * …` | `0.8` | Head outer edge past this fraction of R starts warning |
| Shake strength | `voidShake` → `danger² * …` | `1.7` | Screen shake amplitude (px scale) |
| Shake freqs | `voidShake` | `43.2` / `36.1` | Oscillation rates |
| Boundary glow / sparks | `drawVoidBoundary` | — | Rim bloom, hot stroke when `danger > 0.55`, sparks |

## Black hole proximity — `src/render/cosmic.ts` + `draw.ts`

Visual only. `coreProximity` drives core swell and a second `voidShake` (phase `t + 1.7`).

| Knob | Where | Default | What it does |
|------|-------|---------|--------------|
| Proximity start | `coreProximity` → `RCore * …` | `2.4` | Orbit radius where near-hole juice begins |
| Core swell | `drawVortexCore` → `near² * …` | `0.65` | Max dark-core grow (~+65%) |
| Idle core size | `drawVortexCore` → `0.48` | `0.48` | Drawn core as fraction of `RCore` when idle |
| Feed grow | `drawVortexCore` → `feedEase * …` | `0.50` | Extra core size while swallowing |

Collision ring stays at exact `RCore` (thin stroke in `drawVortex`).

## Death / eat FX — `src/fx/effects.ts`

| Knob | Default | What it does |
|------|---------|--------------|
| `EAT_LIFE` | `0.15` | Eat pop duration (s) |
| `PLUS_LIFE` | `0.45` | “+1” float duration |
| `EAT_GLOW_LIFE` | `0.42` | Head→tail yellow digest glow duration |
| `DEATH_FREEZE` | `0.55` | Crash death freeze before title |
| `SHAKE_LIFE` / `SHAKE_PX` | `0.5` / `3.5` | Crash death camera shake |
| `FLASH_LIFE` | `0.45` | Crash worm flash |
| `SUCK_LIFE` | `0.85` | Black-hole swallow length (= freeze) |

Eat digest glow band / softness: `drawEatGlow` in `src/render/entities.ts`. Suck worm morph (ease, thin, fade): same file (`suckEase`, `suckPoint`, `thickScale`). Suck SFX: `playWoosh` in `src/platform/audio.ts`.

## Audio — `src/platform/audio.ts`

SFX and BGM are independent mutes (title buttons: speaker + music note). Both route through Web Audio so iOS mix stays consistent — HTMLAudio alone was overpowering BufferSource SFX on mobile.

| Knob | Default | What it does |
|------|---------|--------------|
| `SFX_MASTER` | `1.55` | Multiplier on all SFX gain nodes |
| `MUSIC_GAIN` | `0.055` | BGM GainNode level (element volume stays 1) |
| `EAT_VOL` / `CRASH_VOL` / `WOOSH_VOL` | `1` / `0.95` / `1` | Per-SFX relative gains |

Prefs: `wormular.sfxEnabled`, `wormular.musicEnabled` (legacy `wormular.soundEnabled` migrates into both once).

## Title overlay — `src/style.css` / `src/ui/title.ts`

| Knob | Default | What it does |
|------|---------|--------------|
| Hold prompt pulse | `2s` ease-in-out, scale `0.96`–`1.06` | Grow/shrink on Press & Hold copy |
| Online match status | center hold prompt | Ready / finding / waiting / error (same spot) |
| Title fade-in | `0.45s` opacity | Overlay chrome fades in after death |
| Mode swipe threshold | `48px` (`SWIPE_THRESHOLD_PX`) | Horizontal drag distance to change mode without starting |
| Mode hold-commit | `120ms` (`HOLD_COMMIT_MS`) | Press-and-hold can start once the finger has not begun a swipe |
| Mode tap slop | `14px` (`TAP_SLOP_PX`) | Horizontal jitter ignored when committing a hold-start |
| Mode orbit slide | `420ms` (`MODE_ORBIT_MS` / `--orbit-ms`) | Live arenas slide/scale; caption/bottom use the same duration |
| Title launch | `300ms` (`TITLE_LAUNCH_MS`) | Selected arena expands centerScale→1 while peeks + chrome fade into play |
| Mode peek inset | JS `orbitLayout()` gap + ~18% peek clip | Peeks sit beside a scaled-down selected arena; a slight off-screen clip keeps them recessed |
| Mode peek labels | `--peek-label-nudge` from visible crescent | Labels stay on-screen and centered under the visible part of each clipped peek |
| Mode peek size | `~22–24vw` (capped) | Side preview diameter; synced to CSS `--peek-d` |
| Mode peek previews | canvas plate + mini arena | Opaque disk + paused Solo / 1v1 world; HTML face is a neutral ring/hit target |
| Title center scale | `centerScale` from `orbitLayout()` | Selected mode shrinks on title so neighbor peeks read as separate carousel items |

## Camera shake stack — `src/render/draw.ts`

Per frame: death `shakeOffset(fx)` + wall `voidShake(t, danger)` + hole `voidShake(t + 1.7, near)`.
