import { describe, expect, it } from 'vitest'
import { seatFromClientX } from '../../src/input/dualHold'

function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    top: 0,
    right: left + width,
    bottom: 100,
    width,
    height: 100,
    toJSON: () => ({}),
  }
}

describe('seatFromClientX', () => {
  it('maps left half to orange (P0) and right half to teal (P1)', () => {
    const bounds = rect(10, 200)
    expect(seatFromClientX(10, bounds)).toBe(0)
    expect(seatFromClientX(109, bounds)).toBe(0)
    expect(seatFromClientX(110, bounds)).toBe(1)
    expect(seatFromClientX(209, bounds)).toBe(1)
  })
})
