import { describe, expect, it } from 'vitest'
import type { Apple, World } from '../../src/core/types'
import {
  appleSpawnPopScale,
  syncSpawnPops,
} from '../../src/render/entities'

function shell(seed = 1): World {
  return {
    R: 200,
    RCore: 24,
    worm: { r: 80, theta: 0, vr: 0, points: [] },
    rocks: [],
    apple: null,
    score: 0,
    speed: 1,
    alive: true,
    events: [],
    nextRockId: 1,
    pointsSinceLastRock: 0,
    seed,
  }
}

function apple(x: number, y: number): Apple {
  return { x, y, radius: 10, color: 'red' }
}

describe('battle starfruit spawn pops', () => {
  it('only the respawned apple re-pops when the other stays', () => {
    const world = shell(42)
    const kept = apple(40, -30)
    const eaten = apple(-50, 20)
    syncSpawnPops(world, 0, [eaten, kept])

    // Let both finish pop-in.
    expect(appleSpawnPopScale(kept, 1)).toBeCloseTo(1, 5)
    expect(appleSpawnPopScale(eaten, 1)).toBeCloseTo(1, 5)

    const respawned = apple(12, 60)
    syncSpawnPops(world, 1, [respawned, kept])

    // Surviving fruit must not restart zoom-in.
    expect(appleSpawnPopScale(kept, 1)).toBeCloseTo(1, 5)
    // New fruit starts near the pop-in floor.
    expect(appleSpawnPopScale(respawned, 1)).toBeLessThan(0.15)
  })
})
