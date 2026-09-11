import type { Tunables } from './config'
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
 * The live head may sit slightly ahead of the newest sample (last index).
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

/** Lay a short arc behind the starting head so the worm begins as a body, not a dot. */
export function seedBody(
  worm: Worm,
  length: number,
  spacing: number,
): void {
  const head = polarToCart(worm.r, worm.theta)
  // Oldest → newest so deposits can push() in O(1).
  const points: Vec2[] = []
  let remaining = length
  let theta = worm.theta
  const r = worm.r
  const older: Vec2[] = []
  while (remaining > spacing) {
    const dTheta = spacing / Math.max(r, 1)
    theta -= dTheta
    older.push(polarToCart(r, theta))
    remaining -= spacing
  }
  for (let i = older.length - 1; i >= 0; i--) points.push(older[i]!)
  points.push(head)
  worm.points = points
}

/**
 * Drop fixed-spacing samples from the last deposited point toward `head`.
 * Existing samples are never rewritten — only new ones are appended.
 */
function depositAlongPath(points: Vec2[], head: Vec2, spacing: number): void {
  if (points.length === 0) {
    points.push({ x: head.x, y: head.y })
    return
  }

  for (;;) {
    const newest = points[points.length - 1]!
    const dx = head.x - newest.x
    const dy = head.y - newest.y
    const d = Math.hypot(dx, dy)
    if (d < spacing) break

    const t = spacing / d
    points.push({
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

/** Drop oldest samples beyond maxLen (newest is at the end). */
function trimTrail(points: Vec2[], maxLen: number): void {
  if (points.length < 2) return

  let len = 0
  let oldestKeep = 0
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i]!
    const b = points[i - 1]!
    const seg = distApprox(a, b)
    if (len + seg > maxLen) {
      const remain = maxLen - len
      const t = remain / seg
      // Clip only the oldest tip so total length matches.
      points[i - 1] = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
      oldestKeep = i - 1
      break
    }
    len += seg
    oldestKeep = i - 1
  }
  if (oldestKeep > 0) points.splice(0, oldestKeep)
}

export function trailLength(points: Vec2[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += distApprox(points[i - 1]!, points[i]!)
  }
  return len
}

/** Polyline for draw/collide: deposited path + live head (skip duplicate if coincident). */
export function bodyPolyline(worm: Worm): Vec2[] {
  const head = headPos(worm)
  if (worm.points.length === 0) return [head]
  const newest = worm.points[worm.points.length - 1]!
  if (Math.hypot(head.x - newest.x, head.y - newest.y) < 0.05) {
    return worm.points
  }
  return [...worm.points, head]
}
