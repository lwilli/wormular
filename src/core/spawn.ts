import type { Tunables } from './config'
import {
  MAX_ROCKS,
  ROCK_SPAWN_CHANCE,
  ROCK_SPAWN_CLEAR_ARC,
  ROCK_SPAWN_MAX_GAP,
  SPAWN_EDGE_MARGIN_FRAC,
  START_ROCK_COUNT,
  START_THETA,
} from './config'
import type { Apple, AppleColor, Rock, Vec2, World } from './types'
import { createRng, dist, polarToCart } from './types'

const SPAWN_ATTEMPTS = 40

export function spawnInitialRocks(
  tunables: Tunables,
  rng: () => number,
  nextId: { value: number },
  count: number = START_ROCK_COUNT,
  wormPoints: Vec2[] = [],
  startTheta: number = START_THETA,
): Rock[] {
  const rocks: Rock[] = []
  for (let i = 0; i < count; i++) {
    const rock = trySpawnRock(
      tunables,
      rocks,
      wormPoints,
      rng,
      nextId.value,
      startTheta,
    )
    if (rock) {
      nextId.value += 1
      rocks.push(rock)
    }
  }
  return rocks
}

export function spawnApple(
  world: World,
  tunables: Tunables,
  rng: () => number,
): Apple | null {
  const color: AppleColor = rng() < 0.5 ? 'red' : 'green'
  for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
    const pos = randomAnnulusPoint(tunables, rng, tunables.appleRadius)
    if (
      clearOfRocks(pos, tunables.appleRadius, world.rocks) &&
      clearOfWorm(
        pos,
        tunables.appleRadius,
        world.worm.points,
        tunables.wormThickness,
      )
    ) {
      return {
        x: pos.x,
        y: pos.y,
        radius: tunables.appleRadius,
        color,
      }
    }
  }
  return null
}

/**
 * After an eat (score already advanced): always try at score 1–2; from 3+
 * use ROCK_SPAWN_CHANCE unless pointsSinceLastRock would exceed ROCK_SPAWN_MAX_GAP.
 */
export function maybeSpawnRock(
  world: World,
  tunables: Tunables,
  rng: () => number,
): Rock | null {
  world.pointsSinceLastRock += 1

  if (world.rocks.length >= MAX_ROCKS) return null

  const force =
    world.score <= 2 || world.pointsSinceLastRock >= ROCK_SPAWN_MAX_GAP
  if (!force && rng() > ROCK_SPAWN_CHANCE) return null

  const rock = trySpawnRock(
    tunables,
    world.rocks,
    world.worm.points,
    rng,
    world.nextRockId,
    world.worm.theta,
  )
  if (rock) {
    world.nextRockId += 1
    world.pointsSinceLastRock = 0
  }
  return rock
}

function trySpawnRock(
  tunables: Tunables,
  rocks: Rock[],
  wormPoints: Vec2[],
  rng: () => number,
  id: number,
  /** Reject rocks in the forward clear arc from this heading. */
  clearArcTheta: number | null = null,
): Rock | null {
  const radius =
    tunables.rockMin + rng() * (tunables.rockMax - tunables.rockMin)
  for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
    const pos = randomAnnulusPoint(tunables, rng, radius)
    if (
      clearArcTheta !== null &&
      inForwardArc(pos, clearArcTheta, ROCK_SPAWN_CLEAR_ARC)
    ) {
      continue
    }
    if (!clearOfRocks(pos, radius, rocks)) continue
    if (
      wormPoints.length > 0 &&
      !clearOfWorm(pos, radius, wormPoints, tunables.wormThickness)
    ) {
      continue
    }
    return { id, x: pos.x, y: pos.y, radius }
  }
  return null
}

/** True if pos lies within `arc` radians ahead of heading (travel direction). */
function inForwardArc(pos: Vec2, heading: number, arc: number): boolean {
  const a = Math.atan2(pos.y, pos.x)
  let delta = a - heading
  while (delta < 0) delta += Math.PI * 2
  while (delta >= Math.PI * 2) delta -= Math.PI * 2
  return delta < arc
}

function randomAnnulusPoint(
  tunables: Tunables,
  rng: () => number,
  objectRadius = 0,
): Vec2 {
  const edge = SPAWN_EDGE_MARGIN_FRAC * tunables.R
  const minR = tunables.RCore + objectRadius + tunables.wormThickness + edge
  const maxR = tunables.R - objectRadius - tunables.wormThickness - edge
  const r = minR + rng() * Math.max(0, maxR - minR)
  const theta = rng() * Math.PI * 2
  return polarToCart(r, theta)
}

function clearOfRocks(pos: Vec2, radius: number, rocks: Rock[]): boolean {
  const pad = 8
  for (const rock of rocks) {
    if (dist(pos, rock) < radius + rock.radius + pad) return false
  }
  return true
}

function clearOfWorm(
  pos: Vec2,
  radius: number,
  points: Vec2[],
  thickness: number,
): boolean {
  const pad = thickness * 0.5 + 6
  for (const p of points) {
    if (dist(pos, p) < radius + pad) return false
  }
  return true
}

export function rngFromSeed(seed: number): () => number {
  return createRng(seed)
}
