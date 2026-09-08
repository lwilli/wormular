import { describe, expect, it } from 'vitest'
import { FIXED_DT, tunablesForRadius } from '../../src/core/config'
import { checkCollisions } from '../../src/core/collide'
import { createWorld, step } from '../../src/core/world'
import { trailLength } from '../../src/core/worm'
import type { World } from '../../src/core/types'

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
    const points = [
      { x: 100, y: 0 },
      { x: 100 - half, y: 0 },
      { x: 100 - half * 2, y: 0 },
    ]
    const worm = { r: 100, theta: 0, vr: 0, points }
    const result = checkCollisions(worm, [], null, tunables)
    expect(result.kind).not.toBe('death')
  })

  it('head vs tail does die', () => {
    const tunables = tunablesForRadius(R)
    const half = tunables.wormThickness * 0.5
    // Build a long trail that loops back near the head, past the neck window.
    const points = [{ x: 100, y: 0 }]
    let x = 100
    for (let i = 0; i < 40; i++) {
      x -= tunables.pointSpacing
      points.push({ x, y: 0 })
    }
    // Curve around and place a tail point on the head.
    points.push({ x: 100, y: half * 0.5 })

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
    const idx = Math.min(4, world.worm.points.length - 2)
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
        let delta = Math.atan2(rock.y, rock.x) - world.worm.theta
        while (delta < 0) delta += Math.PI * 2
        while (delta >= Math.PI * 2) delta -= Math.PI * 2
        expect(delta).toBeGreaterThanOrEqual(Math.PI)
      }
    }
  })
})
