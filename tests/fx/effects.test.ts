import { describe, expect, it } from 'vitest'
import {
  createFx,
  eatGlowProgress,
  handleBattleAteFood,
  handleGameEvent,
} from '../../src/fx/effects'

describe('eat glow player tagging', () => {
  it('solo AteFood leaves eatGlowPlayer null', () => {
    const fx = createFx()
    handleGameEvent(fx, {
      type: 'AteFood',
      x: 0,
      y: 0,
      color: 'red',
      radius: 8,
    })
    expect(fx.eatGlowPlayer).toBeNull()
    expect(eatGlowProgress(fx)).not.toBeNull()
  })

  it('battle AteFood tags the eater seat', () => {
    const fx = createFx()
    handleBattleAteFood(fx, { player: 1, x: 10, y: 20, radius: 8 })
    expect(fx.eatGlowPlayer).toBe(1)
    expect(eatGlowProgress(fx)).not.toBeNull()

    handleBattleAteFood(fx, { player: 0, x: 1, y: 2, radius: 8 })
    expect(fx.eatGlowPlayer).toBe(0)
  })
})
