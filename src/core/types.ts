export type Vec2 = { x: number; y: number }

export type DeathCause = 'rock' | 'wall' | 'center' | 'self'

export type GameEvent =
  | { type: 'AteFood'; x: number; y: number }
  | { type: 'Died'; x: number; y: number; cause: DeathCause }

export type AppleColor = 'red' | 'green'

export type Apple = {
  x: number
  y: number
  radius: number
  color: AppleColor
}

export type Rock = {
  id: number
  x: number
  y: number
  radius: number
}

export type Worm = {
  r: number
  theta: number
  vr: number
  /**
   * Deposited path samples, newest at index 0.
   * Samples are never moved after deposit (ink trail); live head is worm.r/theta.
   */
  points: Vec2[]
}

export type World = {
  R: number
  RCore: number
  worm: Worm
  rocks: Rock[]
  apple: Apple | null
  score: number
  speed: number
  alive: boolean
  events: GameEvent[]
  nextRockId: number
  seed: number
}

export type StepInput = {
  holding: boolean
}

export function polarToCart(r: number, theta: number): Vec2 {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) }
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(dist2(a, b))
}

/** Mulberry32 — tiny seeded PRNG for deterministic sims/tests. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
