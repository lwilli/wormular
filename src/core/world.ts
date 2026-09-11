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
  spawnInitialRocks,
} from './spawn'
import type { StepInput, World } from './types'
import {
  advanceWorm,
  headPos,
  seedBody,
} from './worm'

export type CreateWorldOptions = {
  /** Floating rocks to spawn (center rock always present). Default: START_ROCK_COUNT. */
  rockCount?: number
}

export function createWorld(
  R: number,
  seed = Date.now(),
  options: CreateWorldOptions = {},
): World {
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

  const rocks =
    rockCount > 0
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
    pointsSinceLastRock: 0,
    seed,
  }

  world.apple = spawnApple(world, tunables, rng)

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
