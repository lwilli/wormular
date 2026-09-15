import { apiBase } from './leaderboard'
import type { PlayModeStat } from '../../shared/protocol'

/**
 * Fire-and-forget first-party counters. No cookies, no localStorage, no
 * third-party scripts — just aggregate totals on our API.
 */
export function trackVisit(): void {
  ping(`${apiBase()}/visit`)
}

/** Count a started run: solo / local 1v1 / online 1v1. */
export function trackPlay(mode: PlayModeStat): void {
  ping(`${apiBase()}/play?mode=${mode}`)
}

function ping(url: string): void {
  void fetch(url, {
    method: 'POST',
    mode: 'cors',
    keepalive: true,
  }).catch(() => {
    // Offline / local without API — ignore.
  })
}
