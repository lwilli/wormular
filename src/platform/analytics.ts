import { apiBase } from './leaderboard'

/**
 * Fire-and-forget page visit. First-party only: no cookies, no localStorage,
 * no third-party scripts — just increments an aggregate counter on our API.
 */
export function trackVisit(): void {
  const url = `${apiBase()}/visit`
  void fetch(url, {
    method: 'POST',
    mode: 'cors',
    keepalive: true,
  }).catch(() => {
    // Offline / local without API — ignore.
  })
}
