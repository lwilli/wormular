import type { Tunables } from './config'
import { START_RADIUS_FRAC } from './config'
import type { Vec2, Worm } from './types'
import { polarToCart } from './types'

export function targetLength(tunables: Tunables, apples: number): number {
  return tunables.baseLength + apples * tunables.lengthPerApple
}

export function headPos(worm: Worm): Vec2 {
  return polarToCart(worm.r, worm.theta)
}

/**
 * Body is an ink trail: samples are deposited behind the head and never moved.
 * The live head may sit slightly ahead of points[0]; draw/collide should use headPos().
 */
export function advanceWorm(
  worm: Worm,
  tunables: Tunables,
  holding: boolean,
  speed: number,
  apples: number,
  dt: number,
): void {
  worm.vr += (holding ? tunables.thrust : -tunables.gravity) * dt
  worm.vr *= Math.exp(-tunables.drag * dt)
  worm.r += worm.vr * dt
  worm.theta += (speed / Math.max(worm.r, tunables.RCore)) * dt

  const head = polarToCart(worm.r, worm.theta)
  depositAlongPath(worm.points, head, tunables.pointSpacing)
  trimTrail(worm.points, targetLength(tunables, apples))
}

/** Title-screen motion: fixed radius, constant tangential crawl. */
export function advanceWormCircular(
  worm: Worm,
  tunables: Tunables,
  speed: number,
  apples: number,
  dt: number,
): void {
  worm.vr = 0
  worm.r = START_RADIUS_FRAC * tunables.R
  worm.theta += (speed / Math.max(worm.r, tunables.RCore)) * dt
  const head = polarToCart(worm.r, worm.theta)
  depositAlongPath(worm.points, head, tunables.pointSpacing)
  trimTrail(worm.points, targetLength(tunables, apples))
}

/** Lay a short arc behind the starting head so the worm begins as a body, not a dot. */
export function seedBody(
  worm: Worm,
  length: number,
  spacing: number,
): void {
  const head = polarToCart(worm.r, worm.theta)
  worm.points = [head]
  // Travel increases theta, so the body trails toward smaller theta on the same orbit.
  let remaining = length
  let theta = worm.theta
  const r = worm.r
  while (remaining > spacing) {
    const dTheta = spacing / Math.max(r, 1)
    theta -= dTheta
    worm.points.push(polarToCart(r, theta))
    remaining -= spacing
  }
}

/**
 * Drop fixed-spacing samples from the last deposited point toward `head`.
 * Existing samples are never rewritten — only new ones are prepended.
 */
function depositAlongPath(points: Vec2[], head: Vec2, spacing: number): void {
  if (points.length === 0) {
    points.push({ x: head.x, y: head.y })
    return
  }

  // Deposit while the head has pulled more than `spacing` ahead of the newest sample.
  // New samples are exact copies of positions along that segment; older samples stay put.
  for (;;) {
    const newest = points[0]!
    const dx = head.x - newest.x
    const dy = head.y - newest.y
    const d = Math.hypot(dx, dy)
    if (d < spacing) break

    const t = spacing / d
    points.unshift({
      x: newest.x + dx * t,
      y: newest.y + dy * t,
    })
  }
}

function distApprox(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/** Drop tail samples beyond maxLen. May clip only the final tip point. */
function trimTrail(points: Vec2[], maxLen: number): void {
  if (points.length < 2) return

  let len = 0
  let keep = 1
  for (let i = 1; i < points.length; i++) {
    const seg = distApprox(points[i - 1]!, points[i]!)
    if (len + seg > maxLen) {
      const remain = maxLen - len
      const t = remain / seg
      const a = points[i - 1]!
      const b = points[i]!
      // Only the tip is clipped so total length matches; no interior sample moves.
      points[i] = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
      keep = i + 1
      break
    }
    len += seg
    keep = i + 1
  }
  points.length = keep
}

export function trailLength(points: Vec2[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += distApprox(points[i - 1]!, points[i]!)
  }
  return len
}

/** Polyline for draw/collide: live head + deposited path (skip duplicate if coincident). */
export function bodyPolyline(worm: Worm): Vec2[] {
  const head = headPos(worm)
  if (worm.points.length === 0) return [head]
  const newest = worm.points[0]!
  if (Math.hypot(head.x - newest.x, head.y - newest.y) < 0.05) {
    return worm.points
  }
  return [head, ...worm.points]
}
