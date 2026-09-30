import { Share } from '@capacitor/share'
import { isNativePlatform } from './kv'

/** Public web URL (GitHub Pages). Update App Store URL once the listing exists. */
export const WORMULAR_WEB_URL = 'https://lwilli.github.io/wormular/'
/** Placeholder until App Store Connect listing is live. */
export const WORMULAR_APP_STORE_URL = ''

export type ShareScoreOpts = {
  score: number
  /** Optional custom body; defaults to the stock challenge line. */
  text?: string
}

export function buildShareText(score: number): string {
  const lines = [
    `I scored ${score.toLocaleString('en-US')} in Wormular.`,
    'Can you beat me?',
    WORMULAR_WEB_URL,
  ]
  if (WORMULAR_APP_STORE_URL) lines.push(WORMULAR_APP_STORE_URL)
  return lines.join('\n')
}

/** Share copy for Local / Online battle results. */
export function buildBattleShareText(headline: string, detail?: string): string {
  const scoreLine = detail?.trim() ? ` (${detail.trim()})` : ''
  const lines = [
    `${headline}${scoreLine} in Wormular.`,
    'Can you beat that?',
    WORMULAR_WEB_URL,
  ]
  if (WORMULAR_APP_STORE_URL) lines.push(WORMULAR_APP_STORE_URL)
  return lines.join('\n')
}

/**
 * Native share sheet on iOS; Web Share API on supporting browsers;
 * clipboard fallback otherwise. Returns false if everything fails.
 */
export async function shareScore(opts: ShareScoreOpts): Promise<boolean> {
  const text = opts.text ?? buildShareText(opts.score)
  const title = 'Wormular'
  try {
    if (isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: 'Share score' })
      return true
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text })
      return true
    }
  } catch {
    // User cancel or unsupported — try clipboard before giving up.
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/** Share is always offered; native / Web Share / clipboard handle delivery. */
export function canShare(): boolean {
  return true
}
