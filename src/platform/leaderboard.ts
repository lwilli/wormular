import {
  LEADERBOARD_LIMIT,
  type ScoresResponse,
  type ScoreRow,
  type SubmitScoreResponse,
} from '../../shared/protocol'

/** Base URL for the Wormular API. Empty = same-origin `/api` (Vite proxy / Pages rewrite). */
export function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '')
  return '/api'
}

export async function fetchLeaderboard(
  limit = LEADERBOARD_LIMIT,
): Promise<ScoreRow[]> {
  const url = `${apiBase()}/scores?limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`leaderboard ${res.status}`)
  const body = (await res.json()) as ScoresResponse
  return body.scores ?? []
}

export async function submitScore(
  name: string,
  score: number,
  platform?: string,
): Promise<SubmitScoreResponse> {
  const res = await fetch(`${apiBase()}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, platform }),
  })
  if (res.status === 429) throw new Error('rate limited')
  if (!res.ok) throw new Error(`submit ${res.status}`)
  return (await res.json()) as SubmitScoreResponse
}
