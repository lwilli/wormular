import { describe, expect, it } from 'vitest'
import { seatFromClientY } from '../../src/input/dualHold'

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    top,
    right: 100,
    bottom: top + height,
    width: 100,
    height,
    toJSON: () => ({}),
  }
}

describe('seatFromClientY', () => {
  it('maps top half to orange (P0) and bottom half to teal (P1)', () => {
    const bounds = rect(10, 200)
    expect(seatFromClientY(10, bounds)).toBe(0)
    expect(seatFromClientY(109, bounds)).toBe(0)
    expect(seatFromClientY(110, bounds)).toBe(1)
    expect(seatFromClientY(209, bounds)).toBe(1)
  })
})