/** Tunables as fractions of arena radius R (except drag). Keep all magic here. */

export const FIXED_DT = 1 / 60

export const CORE_RADIUS_FRAC = 0.12
export const SPEED_FRAC = 0.35
export const SPEED_PER_APPLE_FRAC = 0.012
export const THRUST_FRAC = 1.8
export const GRAVITY_FRAC = 1.4
export const DRAG = 2.2
export const WORM_THICKNESS_FRAC = 0.028
export const BASE_LENGTH_FRAC = 0.35
export const LENGTH_PER_APPLE_FRAC = 0.12
export const POINT_SPACING_PX = 3
export const NECK_THICKNESSES = 2
export const APPLE_RADIUS_FRAC = 0.035
export const ROCK_MIN_FRAC = 0.04
export const ROCK_MAX_FRAC = 0.07
export const START_ROCK_COUNT = 2
export const MAX_ROCKS = 12
export const ROCK_SPAWN_CHANCE = 0.35
/** Extra clearance from center rock / outer wall when spawning apples & rocks. */
export const SPAWN_EDGE_MARGIN_FRAC = 0.06
/** Inset from the short viewport edge to the arena rim (each side). */
export const ARENA_PADDING_PX = 24
/** Tighter inset when the short side is phone-narrow (width-limited portrait). */
export const ARENA_PADDING_NARROW_PX = 12
/** Use narrow padding when min(viewW, viewH) is below this. */
export const ARENA_NARROW_SIDE_PX = 400
export const START_RADIUS_FRAC = 0.45
/** Fixed launch heading (radians). 0 = +x; worm always starts here. */
export const START_THETA = 0
/** No initial rocks in this forward arc from START_THETA (radians). */
export const START_ROCK_CLEAR_ARC = Math.PI
/** Ignore restart attempts for this long after death → title. */
export const TITLE_RESTART_COOLDOWN_MS = 500

export type Tunables = {
  R: number
  RCore: number
  speed: number
  speedPerApple: number
  thrust: number
  gravity: number
  drag: number
  wormThickness: number
  baseLength: number
  lengthPerApple: number
  pointSpacing: number
  neckWindow: number
  appleRadius: number
  rockMin: number
  rockMax: number
}

export function tunablesForRadius(R: number): Tunables {
  const wormThickness = WORM_THICKNESS_FRAC * R
  return {
    R,
    RCore: CORE_RADIUS_FRAC * R,
    speed: SPEED_FRAC * R,
    speedPerApple: SPEED_PER_APPLE_FRAC * R,
    thrust: THRUST_FRAC * R,
    gravity: GRAVITY_FRAC * R,
    drag: DRAG,
    wormThickness,
    baseLength: BASE_LENGTH_FRAC * R,
    lengthPerApple: LENGTH_PER_APPLE_FRAC * R,
    pointSpacing: POINT_SPACING_PX,
    neckWindow: NECK_THICKNESSES * wormThickness,
    appleRadius: APPLE_RADIUS_FRAC * R,
    rockMin: ROCK_MIN_FRAC * R,
    rockMax: ROCK_MAX_FRAC * R,
  }
}
