import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const KEY = 'wormular.highScore'

let cache = 0
let ready = false

function parseScore(raw: string | null): number {
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function loadLocal(): number {
  try {
    return parseScore(localStorage.getItem(KEY))
  } catch {
    return 0
  }
}

function saveLocal(score: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    // Ignore quota / private mode.
  }
}

async function loadNative(): Promise<number> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return parseScore(value)
  } catch {
    return 0
  }
}

async function saveNative(score: number): Promise<void> {
  try {
    await Preferences.set({
      key: KEY,
      value: String(Math.max(0, Math.floor(score))),
    })
  } catch {
    // Ignore native storage failures.
  }
}

function useNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Hydrate cache before the game loop reads the high score. */
export async function initStorage(): Promise<void> {
  if (ready) return
  cache = useNative() ? await loadNative() : loadLocal()
  ready = true
}

export function loadHighScore(): number {
  if (!ready) {
    // Sync fallback for web / tests before initStorage().
    cache = loadLocal()
  }
  return cache
}

export function saveHighScore(score: number): void {
  const next = Math.max(0, Math.floor(score))
  cache = next
  if (useNative()) {
    void saveNative(next)
  } else {
    saveLocal(next)
  }
}

export function recordScore(score: number): number {
  const best = Math.max(loadHighScore(), score)
  saveHighScore(best)
  return best
}
