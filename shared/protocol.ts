/** Shared client ↔ API / WebSocket protocol for leaderboard + PvP. */

export const MAX_SCORE = 10_000
export const NAME_MIN = 3
export const NAME_MAX = 12
export const LEADERBOARD_LIMIT = 50

export type ScoreRow = {
  id: number
  name: string
  score: number
  createdAt: string
  platform?: string
}

export type ScoresResponse = {
  scores: ScoreRow[]
}

export type SubmitScoreRequest = {
  name: string
  score: number
  platform?: string
}

export type SubmitScoreResponse = {
  ok: true
  best: number
  rank: number | null
}

/** Cookieless aggregate counters (`POST /visit`, `POST /play`, `GET /stats`). */
export type PlayModeStat = 'solo' | 'local' | 'online' | 'online_queue'

export const PLAY_MODE_STATS: readonly PlayModeStat[] = [
  'solo',
  'local',
  'online',
  'online_queue',
]

export type VisitResponse = {
  ok: true
}

export type PlayResponse = {
  ok: true
}

export type StatsResponse = {
  visits: number
  plays: {
    solo: number
    local: number
    online: number
    /** Times a player entered the online waiting/queue state. */
    online_queue: number
  }
}

/** Client → room */
export type ClientMsg =
  | { type: 'hello'; name: string }
  | { type: 'input'; tick: number; holding: boolean }
  /** Match already ended locally (death) — closing must not count as a forfeit. */
  | { type: 'finish' }
  | { type: 'ping' }

/** Room → client */
export type ServerMsg =
  | { type: 'queued' }
  | { type: 'start'; seed: number; you: 0 | 1; opponentName: string }
  | { type: 'inputs'; tick: number; holding: [boolean, boolean] }
  | { type: 'forfeit'; winner: 0 | 1; reason: string }
  | { type: 'error'; message: string }
  | { type: 'pong' }

export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return null
  return name
}

export function clampScore(score: number): number | null {
  if (!Number.isFinite(score)) return null
  const n = Math.floor(score)
  if (n < 0 || n > MAX_SCORE) return null
  return n
}
