import type { Tunables } from './config'
import type { Apple, DeathCause, Rock, Vec2, Worm } from './types'
import { dist } from './types'
import { bodyPolyline, headPos } from './worm'

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

  if (hitsSelf(head, bodyPolyline(worm), half, tunables.neckWindow)) {
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
  let along = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = dist(a, b)
    along += seg
    if (along < neckWindow) continue
    if (dist(head, b) < headRadius + headRadius * 0.85) {
      return true
    }
  }
  return false
}
