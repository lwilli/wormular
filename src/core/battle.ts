import {
  START_RADIUS_FRAC,
  START_ROCK_COUNT,
  START_THETA,
  tunablesForRadius,
} from './config'
import { checkBattleCollisions } from './collide'
import {
  maybeSpawnBattleRock,
  rngFromSeed,
  spawnBattleApple,
  spawnInitialRocks,
} from './spawn'
import type {
  Apple,
  BattleEvent,
  BattlePlayer,
  BattleStepInput,
  BattleWorld,
  DeathCause,
  Worm,
} from './types'
import { advanceWorm, headPos, seedBody } from './worm'

export function createBattleWorld(
  R: number,
  seed = Date.now(),
  rockCount = START_ROCK_COUNT,
): BattleWorld {
  const tunables = tunablesForRadius(R)
  const rng = rngFromSeed(seed)
  const nextId = { value: 1 }
  const r = START_RADIUS_FRAC * R

  const players: [BattlePlayer, BattlePlayer] = [
    makePlayer(r, START_THETA, tunables.baseLength, tunables.pointSpacing, tunables.speed),
    makePlayer(
      r,
      START_THETA + Math.PI,
      tunables.baseLength,
      tunables.pointSpacing,
      tunables.speed,
    ),
  ]

  const allPoints = [...players[0].worm.points, ...players[1].worm.points]
  const rocks =
    rockCount > 0
      ? spawnInitialRocks(tunables, rng, nextId, rockCount, allPoints, null)
      : []

  const world: BattleWorld = {
    R: tunables.R,
    RCore: tunables.RCore,
    players,
    rocks,
    apples: [null, null],
    events: [],
    nextRockId: nextId.value,
    pointsSinceLastRock: 0,
    seed,
    tick: 0,
    winner: null,
  }

  world.apples[0] = spawnBattleApple(
    world.rocks,
    allPoints,
    world.apples,
    tunables,
    rng,
  )
  world.apples[1] = spawnBattleApple(
    world.rocks,
    allPoints,
    world.apples,
    tunables,
    rng,
  )
  return world
}

function makePlayer(
  r: number,
  theta: number,
  baseLength: number,
  pointSpacing: number,
  speed: number,
): BattlePlayer {
  const worm: Worm = { r, theta, vr: 0, points: [] }
  seedBody(worm, baseLength, pointSpacing)
  return { worm, score: 0, speed, alive: true }
}

/** One fixed battle tick. First death ends the match (opponent wins). */
export function stepBattle(
  world: BattleWorld,
  input: BattleStepInput,
  dt: number,
): void {
  world.events = []
  if (world.winner !== null) return

  const tunables = tunablesForRadius(world.R)

  for (let i = 0; i < 2; i++) {
    const p = world.players[i]!
    if (!p.alive) continue
    advanceWorm(p.worm, tunables, input.holding[i]!, p.speed, p.score, dt)
  }

  for (let i = 0; i < 2; i++) {
    const p = world.players[i]!
    if (!p.alive) continue
    const opponent = world.players[1 - i]!
    const hit = checkBattleCollisions(
      p.worm,
      world.rocks,
      world.apples,
      opponent.alive ? opponent.worm.points : [],
      tunables,
    )
    const head = headPos(p.worm)

    if (hit.kind === 'death') {
      p.alive = false
      const ev: BattleEvent = {
        type: 'Died',
        player: i as 0 | 1,
        x: head.x,
        y: head.y,
        cause: hit.cause,
      }
      world.events.push(ev)
      world.winner = (1 - i) as 0 | 1
      return
    }

    if (hit.kind === 'food') {
      p.score += 1
      p.speed = tunables.speed + p.score * tunables.speedPerApple
      world.events.push({
        type: 'AteFood',
        player: i as 0 | 1,
        x: hit.apple.x,
        y: hit.apple.y,
        color: hit.apple.color,
        radius: hit.apple.radius,
      })
      clearApple(world.apples, hit.apple)
      const allPoints = [
        ...world.players[0].worm.points,
        ...world.players[1].worm.points,
      ]
      const combined = world.players[0].score + world.players[1].score
      const nextRockId = { value: world.nextRockId }
      const pointsSince = { value: world.pointsSinceLastRock }
      const rng = rngFromSeed(world.seed + world.tick * 9973 + p.score * 131 + i)
      const extra = maybeSpawnBattleRock(
        world.rocks,
        allPoints,
        nextRockId,
        pointsSince,
        combined,
        p.worm.theta,
        tunables,
        rng,
      )
      world.nextRockId = nextRockId.value
      world.pointsSinceLastRock = pointsSince.value
      if (extra) world.rocks.push(extra)
      const slot = emptyAppleSlot(world.apples)
      if (slot !== null) {
        world.apples[slot] = spawnBattleApple(
          world.rocks,
          allPoints,
          world.apples,
          tunables,
          rng,
        )
      }
    }
  }

  const allPoints = [
    ...world.players[0].worm.points,
    ...world.players[1].worm.points,
  ]
  const rngTop = rngFromSeed(world.seed + world.tick * 4243 + 17)
  for (let slot = 0; slot < 2; slot++) {
    if (!world.apples[slot]) {
      world.apples[slot] = spawnBattleApple(
        world.rocks,
        allPoints,
        world.apples,
        tunables,
        rngTop,
      )
    }
  }

  world.tick += 1
}

function clearApple(apples: [Apple | null, Apple | null], eaten: Apple): void {
  for (let i = 0; i < apples.length; i++) {
    const a = apples[i]
    if (a && a.x === eaten.x && a.y === eaten.y) {
      apples[i] = null
      return
    }
  }
}

function emptyAppleSlot(apples: [Apple | null, Apple | null]): 0 | 1 | null {
  if (!apples[0]) return 0
  if (!apples[1]) return 1
  return null
}

export function battleDeathLabel(cause: DeathCause): string {
  switch (cause) {
    case 'opponent':
      return 'hit opponent'
    case 'center':
      return 'fell in'
    case 'wall':
      return 'hit the rim'
    case 'rock':
      return 'hit a rock'
    case 'self':
      return 'hit self'
  }
}
