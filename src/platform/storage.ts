const KEY = 'wormular.highScore'

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    // Ignore quota / private mode.
  }
}

export function recordScore(score: number): number {
  const best = Math.max(loadHighScore(), score)
  saveHighScore(best)
  return best
}
