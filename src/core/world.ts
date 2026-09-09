import {
  START_RADIUS_FRAC,
  START_ROCK_COUNT,
  START_THETA,
  tunablesForRadius,
} from './config'
import { checkCollisions } from './collide'
import {
  maybeSpawnRock,
  rngFromSeed,
  spawnApple,
  spawnAttractRocks,
  spawnInitialRocks,
} from './spawn'
import type { StepInput, World } from './types'
import { polarToCart } from './types'
import {
  advanceWorm,
  advanceWormCircular,
  headPos,
  seedBody,
} from './worm'

export type CreateWorldOptions = {
  /** Floating rocks to spawn (center rock always present). Default: START_ROCK_COUNT. */
  rockCount?: number
  /** Title attract: circular orbit + rocks parked off that path. */
  attract?: boolean
}

export function createWorld(
  R: number,
  seed = Date.now(),
  options: CreateWorldOptions = {},
): World {
  const attract = options.attract === true
  const rockCount = options.rockCount ?? START_ROCK_COUNT
  const tunables = tunablesForRadius(R)
  const rng = rngFromSeed(seed)
  const nextId = { value: 1 }
  const r = START_RADIUS_FRAC * R
  const theta = START_THETA

  const worm = {
    r,
    theta,
    vr: 0,
    points: [] as { x: number; y: number }[],
  }
  seedBody(worm, tunables.baseLength, tunables.pointSpacing)

  const rocks = attract
    ? spawnAttractRocks(tunables, nextId)
    : rockCount > 0
      ? spawnInitialRocks(
          tunables,
          rng,
          nextId,
          rockCount,
          worm.points,
          START_THETA,
        )
      : []

  const world: World = {
    R: tunables.R,
    RCore: tunables.RCore,
    worm,
    rocks,
    apple: null,
    score: 0,
    speed: tunables.speed,
    alive: true,
    events: [],
    nextRockId: nextId.value,
    seed,
  }

  if (attract) {
    // Park the apple off the orbit so the demo doesn't eat it.
    const appleR = Math.min(
      tunables.R - tunables.appleRadius - tunables.wormThickness,
      START_RADIUS_FRAC * tunables.R +
        tunables.wormThickness +
        tunables.appleRadius +
        tunables.R * 0.12,
    )
    const pos = polarToCart(appleR, Math.PI * 0.6)
    world.apple = {
      x: pos.x,
      y: pos.y,
      radius: tunables.appleRadius,
      color: 'red',
    }
  } else {
    world.apple = spawnApple(world, tunables, rng)
  }

  return world
}

/** One fixed simulation tick. Clears and refills world.events. */
export function step(world: World, input: StepInput, dt: number): void {
  world.events = []
  if (!world.alive) return

  const tunables = tunablesForRadius(world.R)
  advanceWorm(world.worm, tunables, input.holding, world.speed, world.score, dt)

  const hit = checkCollisions(world.worm, world.rocks, world.apple, tunables)
  const head = headPos(world.worm)

  if (hit.kind === 'death') {
    world.alive = false
    world.events.push({
      type: 'Died',
      x: head.x,
      y: head.y,
      cause: hit.cause,
    })
    return
  }

  if (hit.kind === 'food') {
    world.score += 1
    world.speed = tunables.speed + world.score * tunables.speedPerApple
    world.events.push({
      type: 'AteFood',
      x: hit.apple.x,
      y: hit.apple.y,
      color: hit.apple.color,
      radius: hit.apple.radius,
    })

    const rng = rngFromSeed(world.seed + world.score * 9973)
    const extra = maybeSpawnRock(world, tunables, rng)
    if (extra) world.rocks.push(extra)
    world.apple = spawnApple(world, tunables, rng)
  }
}

/** Title-screen tick: circular cruise, no deaths / eating. */
export function stepAttract(world: World, dt: number): void {
  world.events = []
  const tunables = tunablesForRadius(world.R)
  advanceWormCircular(world.worm, tunables, world.speed, world.score, dt)
}
