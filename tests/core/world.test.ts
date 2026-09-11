import { describe, expect, it } from 'vitest'
import {
  FIXED_DT,
  ROCK_SPAWN_CLEAR_ARC,
  ROCK_SPAWN_MAX_GAP,
  tunablesForRadius,
} from '../../src/core/config'
import { checkCollisions } from '../../src/core/collide'
import { createWorld, step } from '../../src/core/world'
import { trailLength } from '../../src/core/worm'
import type { Rock, World } from '../../src/core/types'

const R = 200

function run(
  world: World,
  holding: boolean,
  ticks: number,
): void {
  for (let i = 0; i < ticks; i++) {
    step(world, { holding }, FIXED_DT)
  }
}

/** Place head on the current apple and step once so the eat resolves. */
function eatApple(world: World): void {
  const apple = world.apple
  expect(apple).not.toBeNull()
  world.worm.r = Math.hypot(apple!.x, apple!.y)
  world.worm.theta = Math.atan2(apple!.y, apple!.x)
  world.worm.points = [{ x: apple!.x, y: apple!.y }]
  world.worm.vr = 0
  step(world, { holding: false }, FIXED_DT)
}

function forwardDelta(rock: Rock, theta: number): number {
  let delta = Math.atan2(rock.y, rock.x) - theta
  while (delta < 0) delta += Math.PI * 2
  while (delta >= Math.PI * 2) delta -= Math.PI * 2
  return delta
}

describe('wormular core', () => {
  it('thrust increases r', () => {
    const world = createWorld(R, 1)
    const start = world.worm.r
    run(world, true, 30)
    expect(world.worm.r).toBeGreaterThan(start)
  })

  it('gravity decreases r when not holding', () => {
    const world = createWorld(R, 2)
    world.worm.r = R * 0.6
    world.worm.points = [{ x: world.worm.r, y: 0 }]
    world.worm.theta = 0
    world.worm.vr = 0
    const start = world.worm.r
    run(world, false, 30)
    expect(world.worm.r).toBeLessThan(start)
  })

  it('eating lengthens the worm and increments score', () => {
    const world = createWorld(R, 3)
    const tunables = tunablesForRadius(R)
    const beforeLen = trailLength(world.worm.points)
    const apple = world.apple!
    // Place head on apple.
    world.worm.r = Math.hypot(apple.x, apple.y)
    world.worm.theta = Math.atan2(apple.y, apple.x)
    world.worm.points = [{ x: apple.x, y: apple.y }]
    world.worm.vr = 0

    step(world, { holding: false }, FIXED_DT)

    expect(world.score).toBe(1)
    expect(world.events.some((e) => e.type === 'AteFood')).toBe(true)
    // After one tick post-eat the trail may still be short; grow a bit while held mid-radius.
    world.worm.r = R * 0.5
    world.worm.vr = 0
    run(world, true, 90)
    expect(trailLength(world.worm.points)).toBeGreaterThan(beforeLen)
    expect(trailLength(world.worm.points)).toBeLessThanOrEqual(
      tunables.baseLength + tunables.lengthPerApple + 1,
    )
  })

  it('head vs rock dies', () => {
    const world = createWorld(R, 4)
    world.rocks = [{ id: 1, x: 80, y: 0, radius: 20 }]
    world.worm.r = 80
    world.worm.theta = 0
    world.worm.vr = 0
    world.worm.points = [{ x: 80, y: 0 }]

    step(world, { holding: false }, FIXED_DT)

    expect(world.alive).toBe(false)
    expect(world.events[0]).toMatchObject({ type: 'Died', cause: 'rock' })
  })

  it('head vs neck does not die', () => {
    const tunables = tunablesForRadius(R)
    const half = tunables.wormThickness * 0.5
    // Oldest → newest (near head).
    const points = [
      { x: 100 - half * 2, y: 0 },
      { x: 100 - half, y: 0 },
      { x: 100, y: 0 },
    ]
    const worm = { r: 100, theta: 0, vr: 0, points }
    const result = checkCollisions(worm, [], null, tunables)
    expect(result.kind).not.toBe('death')
  })

  it('head vs tail does die', () => {
    const tunables = tunablesForRadius(R)
    const half = tunables.wormThickness * 0.5
    // Build newest-first then reverse to oldest → newest.
    const points = [{ x: 100, y: 0 }]
    let x = 100
    for (let i = 0; i < 40; i++) {
      x -= tunables.pointSpacing
      points.push({ x, y: 0 })
    }
    // Curve around and place a tip point on the head.
    points.push({ x: 100, y: half * 0.5 })
    points.reverse()

    const worm = { r: 100, theta: 0, vr: 0, points }
    const result = checkCollisions(worm, [], null, tunables)
    expect(result).toEqual({ kind: 'death', cause: 'self' })
  })

  it('hitting center rock dies', () => {
    const world = createWorld(R, 5)
    world.worm.r = world.RCore * 0.5
    world.worm.theta = 0
    world.worm.vr = 0
    world.worm.points = [{ x: world.worm.r, y: 0 }]
    step(world, { holding: false }, FIXED_DT)
    expect(world.alive).toBe(false)
    expect(world.events[0]).toMatchObject({ type: 'Died', cause: 'center' })
  })

  it('deposited body samples do not move after being laid down', () => {
    const world = createWorld(R, 6)
    run(world, true, 45)
    expect(world.worm.points.length).toBeGreaterThan(5)
    // Freeze a mid-body sample (not the oldest tip, which trim may clip).
    const idx = Math.max(1, world.worm.points.length - 5)
    const frozen = { ...world.worm.points[idx]! }
    run(world, true, 30)
    const still = world.worm.points.find(
      (p) => p.x === frozen.x && p.y === frozen.y,
    )
    expect(still).toBeDefined()
  })

  it('without holding, start does not race to the outer wall', () => {
    const world = createWorld(R, 7)
    const startR = world.worm.r
    run(world, false, 45)
    expect(world.alive).toBe(true)
    expect(world.worm.r).toBeLessThan(startR)
    expect(world.worm.r).toBeLessThan(R * 0.9)
  })

  it('always starts at a fixed heading', () => {
    const a = createWorld(R, 10)
    const b = createWorld(R, 99)
    expect(a.worm.theta).toBe(0)
    expect(b.worm.theta).toBe(0)
    expect(a.worm.r).toBeCloseTo(b.worm.r)
  })

  it('does not place initial rocks in the first 180° ahead of start', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const world = createWorld(R, seed)
      for (const rock of world.rocks) {
        expect(forwardDelta(rock, world.worm.theta)).toBeGreaterThanOrEqual(
          ROCK_SPAWN_CLEAR_ARC,
        )
      }
    }
  })

  it('does not place mid-game rocks in the forward clear arc of worm.theta', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const world = createWorld(R, seed, { rockCount: 0 })
      for (let eat = 0; eat < 4; eat++) {
        const apple = world.apple!
        // eatApple aligns theta to the apple; spawn uses that heading.
        const heading = Math.atan2(apple.y, apple.x)
        const beforeIds = new Set(world.rocks.map((r) => r.id))
        eatApple(world)
        expect(world.alive).toBe(true)
        for (const rock of world.rocks) {
          if (beforeIds.has(rock.id)) continue
          expect(forwardDelta(rock, heading)).toBeGreaterThanOrEqual(
            ROCK_SPAWN_CLEAR_ARC,
          )
        }
      }
    }
  })

  it('always spawns a rock after score 1 and 2 when under cap', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const world = createWorld(R, seed, { rockCount: 0 })
      expect(world.rocks.length).toBe(0)

      eatApple(world)
      expect(world.score).toBe(1)
      expect(world.rocks.length).toBe(1)

      eatApple(world)
      expect(world.score).toBe(2)
      expect(world.rocks.length).toBe(2)
    }
  })

  it('never goes more than ROCK_SPAWN_MAX_GAP points without a mid-game rock', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const world = createWorld(R, seed, { rockCount: 0 })
      let scoreAtLastRock = 0

      for (let i = 0; i < 12; i++) {
        const before = world.rocks.length
        eatApple(world)
        expect(world.alive).toBe(true)
        if (world.rocks.length > before) {
          scoreAtLastRock = world.score
        }
        expect(world.score - scoreAtLastRock).toBeLessThanOrEqual(
          ROCK_SPAWN_MAX_GAP,
        )
      }
    }
  })
})
