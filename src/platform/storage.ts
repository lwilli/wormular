import { kvGet, kvGetLocal, kvSet, isNativePlatform } from './kv'

const KEY = 'wormular.highScore'

let cache = 0
let ready = false

function parseScore(raw: string | null): number {
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Hydrate cache before the game loop reads the high score. */
export async function initStorage(): Promise<void> {
  if (ready) return
  const raw = await kvGet(KEY)
  cache = parseScore(raw ?? kvGetLocal(KEY))
  ready = true
}

export function loadHighScore(): number {
  if (!ready) {
    cache = parseScore(kvGetLocal(KEY))
  }
  return cache
}

export function saveHighScore(score: number): void {
  const next = Math.max(0, Math.floor(score))
  cache = next
  void kvSet(KEY, String(next))
}

export function recordScore(score: number): number {
  const best = Math.max(loadHighScore(), score)
  saveHighScore(best)
  return best
}

export { isNativePlatform }
