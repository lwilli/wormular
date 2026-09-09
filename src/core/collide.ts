import type { Tunables } from './config'
import type { Apple, DeathCause, Rock, Vec2, Worm } from './types'
import { dist } from './types'
import { headPos } from './worm'

export type CollisionResult =
  | { kind: 'none' }
  | { kind: 'food'; apple: Apple }
  | { kind: 'death'; cause: DeathCause }

export function checkCollisions(
  worm: Worm,
  rocks: Rock[],
  apple: Apple | null,
  tunables: Tunables,
): CollisionResult {
  const head = headPos(worm)
  const half = tunables.wormThickness * 0.5

  if (worm.r - half <= tunables.RCore) {
    return { kind: 'death', cause: 'center' }
  }
  if (worm.r + half >= tunables.R) {
    return { kind: 'death', cause: 'wall' }
  }

  for (const rock of rocks) {
    if (dist(head, rock) < half + rock.radius) {
      return { kind: 'death', cause: 'rock' }
    }
  }

  if (hitsSelf(head, worm.points, half, tunables.neckWindow)) {
    return { kind: 'death', cause: 'self' }
  }

  if (apple && dist(head, apple) < half + apple.radius) {
    return { kind: 'food', apple }
  }

  return { kind: 'none' }
}

function hitsSelf(
  head: Vec2,
  points: Vec2[],
  headRadius: number,
  neckWindow: number,
): boolean {
  if (points.length === 0) return false

  // Walk head → newest → older. Skip the neck window.
  let along = 0
  let prevX = head.x
  let prevY = head.y
  const hitR = headRadius + headRadius * 0.85
  for (let i = points.length - 1; i >= 0; i--) {
    const b = points[i]!
    along += Math.hypot(b.x - prevX, b.y - prevY)
    prevX = b.x
    prevY = b.y
    if (along < neckWindow) continue
    if (dist(head, b) < hitR) return true
  }
  return false
}
