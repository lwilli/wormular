import { describe, expect, it } from 'vitest'
import { FIXED_DT, tunablesForRadius } from '../../src/core/config'
import { createBattleWorld, stepBattle } from '../../src/core/battle'
import { checkBattleCollisions } from '../../src/core/collide'

const R = 200

describe('battle world', () => {
  it('starts worms on opposite sides', () => {
    const world = createBattleWorld(R, 1)
    const [a, b] = world.players
    expect(Math.abs(a.worm.theta - b.worm.theta)).toBeCloseTo(Math.PI, 5)
    expect(a.worm.r).toBeCloseTo(b.worm.r, 5)
  })

  it('keeps two apples in play', () => {
    const world = createBattleWorld(R, 2)
    expect(world.apples[0]).not.toBeNull()
    expect(world.apples[1]).not.toBeNull()
  })

  it('ends when a player dies (opponent wins)', () => {
    const world = createBattleWorld(R, 3, 0)
    world.players[0].worm.r = R - 1
    world.players[0].worm.vr = 50
    world.players[0].worm.points = [{ x: world.players[0].worm.r, y: 0 }]
    world.players[0].worm.theta = 0

    for (let i = 0; i < 30 && world.winner === null; i++) {
      stepBattle(world, { holding: [true, false] }, FIXED_DT)
    }

    expect(world.winner).toBe(1)
    expect(world.players[0].alive).toBe(false)
    expect(world.events.some((e) => e.type === 'Died' && e.player === 0)).toBe(
      true,
    )
  })

  it('detects head-vs-opponent-body as opponent death', () => {
    const tunables = tunablesForRadius(R)
    const worm = {
      r: 50,
      theta: 0,
      vr: 0,
      points: [{ x: 50, y: 0 }],
    }
    const opponentPoints = [
      { x: 40, y: 0 },
      { x: 50, y: 0 },
      { x: 60, y: 0 },
    ]
    const hit = checkBattleCollisions(worm, [], [null, null], opponentPoints, tunables)
    expect(hit.kind).toBe('death')
    if (hit.kind === 'death') expect(hit.cause).toBe('opponent')
  })
})
