import { describe, expect, it } from 'vitest'
import { soloHeadingLockRotation } from '../../src/render/draw'

/** Apply the same 2D rotation canvas uses: x' = x cos α − y sin α, etc. */
function rotate(x: number, y: number, alpha: number): { x: number; y: number } {
  const c = Math.cos(alpha)
  const s = Math.sin(alpha)
  return { x: x * c - y * s, y: x * s + y * c }
}

describe('soloHeadingLockRotation', () => {
  it('maps the head to 12 o’clock (0, −r) for several headings', () => {
    const r = 100
    for (const theta of [0, Math.PI / 4, Math.PI / 2, Math.PI, -0.7, 2.3]) {
      const wx = r * Math.cos(theta)
      const wy = r * Math.sin(theta)
      const p = rotate(wx, wy, soloHeadingLockRotation(theta))
      expect(p.x).toBeCloseTo(0, 10)
      expect(p.y).toBeCloseTo(-r, 10)
    }
  })

  it('keeps crawl tangent pointing +x (right) at the locked head', () => {
    // World tangent for increasing θ is (−sin θ, cos θ).
    const theta = 1.1
    const tx = -Math.sin(theta)
    const ty = Math.cos(theta)
    const p = rotate(tx, ty, soloHeadingLockRotation(theta))
    expect(p.x).toBeCloseTo(1, 10)
    expect(p.y).toBeCloseTo(0, 10)
  })
})
