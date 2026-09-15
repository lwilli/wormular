import { MatchRoom } from './match-room'
import {
  LEADERBOARD_LIMIT,
  clampScore,
  sanitizeName,
  type ScoresResponse,
  type StatsResponse,
  type SubmitScoreResponse,
  type VisitResponse,
} from '../../shared/protocol'

export { MatchRoom }

export interface Env {
  DB: D1Database
  MATCH_ROOM: DurableObjectNamespace
  ALLOWED_ORIGINS: string
}

const RATE_MS = 3_000
const VISIT_RATE_MS = 2_000
const recentPosts = new Map<string, number>()
const recentVisits = new Map<string, number>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    try {
      if (url.pathname === '/health') {
        return json({ ok: true }, cors)
      }

      if (url.pathname === '/scores' && request.method === 'GET') {
        return await getScores(env, url, cors)
      }

      if (url.pathname === '/scores' && request.method === 'POST') {
        return await postScore(request, env, cors)
      }

      if (url.pathname === '/visit' && request.method === 'POST') {
        return await postVisit(request, env, cors)
      }

      if (url.pathname === '/stats' && request.method === 'GET') {
        return await getStats(env, cors)
      }

      if (
        url.pathname === '/ws/match' &&
        request.headers.get('Upgrade') === 'websocket'
      ) {
        const id = env.MATCH_ROOM.idFromName('queue')
        return env.MATCH_ROOM.get(id).fetch(request)
      }

      return json({ error: 'not found' }, cors, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'server error'
      return json({ error: message }, cors, 500)
    }
  },
}

async function getScores(
  env: Env,
  url: URL,
  cors: HeadersInit,
): Promise<Response> {
  const limitRaw = Number(url.searchParams.get('limit') ?? LEADERBOARD_LIMIT)
  const limit = Math.min(
    LEADERBOARD_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : LEADERBOARD_LIMIT),
  )
  const { results } = await env.DB.prepare(
    `SELECT id, name, score, platform, created_at as createdAt
     FROM scores
     ORDER BY score DESC, created_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all()

  const body: ScoresResponse = {
    scores: (results ?? []).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      score: Number(row.score),
      createdAt: String(row.createdAt),
      platform: row.platform != null ? String(row.platform) : undefined,
    })),
  }
  return json(body, cors)
}

async function postScore(
  request: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For') ??
    'unknown'
  const now = Date.now()
  if (now - (recentPosts.get(ip) ?? 0) < RATE_MS) {
    return json({ error: 'rate limited' }, cors, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, cors, 400)
  }
  if (!body || typeof body !== 'object') {
    return json({ error: 'invalid body' }, cors, 400)
  }
  const rec = body as Record<string, unknown>
  const name = typeof rec.name === 'string' ? sanitizeName(rec.name) : null
  const score = typeof rec.score === 'number' ? clampScore(rec.score) : null
  if (!name || score === null) {
    return json({ error: 'invalid name or score' }, cors, 400)
  }
  const platform =
    typeof rec.platform === 'string' ? rec.platform.slice(0, 32) : null

  recentPosts.set(ip, now)

  await env.DB.prepare(
    `INSERT INTO scores (name, score, platform) VALUES (?, ?, ?)`,
  )
    .bind(name, score, platform)
    .run()

  const bestRow = await env.DB.prepare(
    `SELECT MAX(score) as best FROM scores WHERE name = ?`,
  )
    .bind(name)
    .first<{ best: number }>()

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) + 1 as rank FROM scores WHERE score > ?`,
  )
    .bind(score)
    .first<{ rank: number }>()

  const response: SubmitScoreResponse = {
    ok: true,
    best: Number(bestRow?.best ?? score),
    rank: rankRow?.rank != null ? Number(rankRow.rank) : null,
  }
  return json(response, cors)
}

/** Cookieless page-view ping: increments an aggregate counter only. No cookies, IPs, or user rows stored. */
async function postVisit(
  request: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For') ??
    'unknown'
  const now = Date.now()
  if (now - (recentVisits.get(ip) ?? 0) < VISIT_RATE_MS) {
    const body: VisitResponse = { ok: true }
    return json(body, cors)
  }
  recentVisits.set(ip, now)

  await env.DB.prepare(
    `INSERT INTO counters (name, value) VALUES ('visits', 1)
     ON CONFLICT(name) DO UPDATE SET value = value + 1`,
  ).run()

  const body: VisitResponse = { ok: true }
  return json(body, cors)
}

async function getStats(env: Env, cors: HeadersInit): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT value FROM counters WHERE name = 'visits'`,
  ).first<{ value: number }>()

  const body: StatsResponse = {
    visits: Number(row?.value ?? 0),
  }
  return json(body, cors)
}

function corsHeaders(origin: string | null, allowedCsv: string): HeadersInit {
  const allowed = allowedCsv.split(',').map((s) => s.trim()).filter(Boolean)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  } else if (allowed.length === 1) {
    headers['Access-Control-Allow-Origin'] = allowed[0]!
  }
  return headers
}

function json(data: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
