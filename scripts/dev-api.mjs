#!/usr/bin/env node
/**
 * Local stand-in for the Cloudflare Worker (scores + lockstep matchmaking).
 * Run: node scripts/dev-api.mjs
 * Vite proxies /api/* here during npm run dev.
 */
import http from 'node:http'
import { WebSocketServer } from 'ws'
const LEADERBOARD_LIMIT = 50
const NAME_MIN = 3
const NAME_MAX = 12
const MAX_SCORE = 10_000

function sanitizeName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return null
  return name
}

function clampScore(score) {
  if (!Number.isFinite(score)) return null
  const n = Math.floor(score)
  if (n < 0 || n > MAX_SCORE) return null
  return n
}


const PORT = Number(process.env.PORT || 8787)
const RATE_MS = 5_000
const recentPosts = new Map()

/** @type {{ id: number, name: string, score: number, createdAt: string, platform?: string }[]} */
const scores = []
let nextId = 1

/** @typedef {{ ws: import('ws').WebSocket, name: string, role: 0|1, inputs: Map<number, boolean> }} Seat */
/** @typedef {{ seats: [Seat, Seat], nextTick: number, finished: boolean }} Match */

/** @type {Seat | null} */
let waiting = null

/**
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 */
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg))
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(req, res, status, body) {
  const origin = req.headers.origin
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (origin) headers['Access-Control-Allow-Origin'] = String(origin)
  res.writeHead(status, headers)
  res.end(body === null ? '' : JSON.stringify(body))
}

/**
 * @param {import('http').IncomingMessage} req
 */
async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * @param {Seat} seat
 * @param {Match} match
 */
function attach(seat, match) {
  seat.ws.__seat = seat
  seat.ws.__match = match
}

/**
 * @param {Match} match
 * @param {number} tick
 * @param {boolean} holding
 * @param {Seat} seat
 */
function onInput(match, tick, holding, seat) {
  if (match.finished) return
  if (!Number.isInteger(tick) || tick < 0 || tick > 1_000_000) return
  if (!seat.inputs.has(tick)) seat.inputs.set(tick, !!holding)
  const [p0, p1] = match.seats
  while (p0.inputs.has(match.nextTick) && p1.inputs.has(match.nextTick)) {
    const t = match.nextTick
    const holdingPair = [p0.inputs.get(t), p1.inputs.get(t)]
    p0.inputs.delete(t)
    p1.inputs.delete(t)
    match.nextTick = t + 1
    const msg = { type: 'inputs', tick: t, holding: holdingPair }
    send(p0.ws, msg)
    send(p1.ws, msg)
  }
}

/**
 * @param {import('ws').WebSocket} ws
 */
function onClose(ws) {
  if (waiting && waiting.ws === ws) waiting = null
  const match = /** @type {Match | undefined} */ (ws.__match)
  const seat = /** @type {Seat | undefined} */ (ws.__seat)
  if (match && seat && !match.finished) {
    match.finished = true
    const winner = seat.role === 0 ? 1 : 0
    const msg = { type: 'forfeit', winner, reason: 'disconnect' }
    for (const s of match.seats) send(s.ws, msg)
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const path = url.pathname.replace(/^\/api/, '') || '/'

  if (req.method === 'OPTIONS') {
    json(req, res, 204, null)
    return
  }

  if (path === '/health') {
    json(req, res, 200, { ok: true })
    return
  }

  if (path === '/scores' && req.method === 'GET') {
    const limit = Math.min(
      LEADERBOARD_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit') || LEADERBOARD_LIMIT)),
    )
    const sorted = [...scores].sort((a, b) => b.score - a.score || a.id - b.id)
    json(req, res, 200, { scores: sorted.slice(0, limit) })
    return
  }

  if (path === '/scores' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'local'
    const now = Date.now()
    if (now - (recentPosts.get(ip) || 0) < RATE_MS) {
      json(req, res, 429, { error: 'rate limited' })
      return
    }
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      json(req, res, 400, { error: 'invalid json' })
      return
    }
    const name = typeof body.name === 'string' ? sanitizeName(body.name) : null
    const score = typeof body.score === 'number' ? clampScore(body.score) : null
    if (!name || score === null) {
      json(req, res, 400, { error: 'invalid name or score' })
      return
    }
    recentPosts.set(ip, now)
    const row = {
      id: nextId++,
      name,
      score,
      createdAt: new Date().toISOString(),
      platform:
        typeof body.platform === 'string'
          ? body.platform.slice(0, 32)
          : undefined,
    }
    scores.push(row)
    const best = Math.max(
      ...scores.filter((s) => s.name === name).map((s) => s.score),
    )
    const rank = scores.filter((s) => s.score > score).length + 1
    json(req, res, 200, { ok: true, best, rank })
    return
  }

  json(req, res, 404, { error: 'not found' })
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const path = url.pathname.replace(/^\/api/, '')
  if (path !== '/ws/match') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(String(data))
    } catch {
      send(ws, { type: 'error', message: 'bad json' })
      return
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong' })
      return
    }

    if (msg.type === 'hello') {
      if (ws.__seat) return
      const name = sanitizeName(msg.name) || 'Player'

      if (!waiting || waiting.ws.readyState !== 1) {
        waiting = { ws, name, role: 0, inputs: new Map() }
        ws.__seat = waiting
        send(ws, { type: 'queued' })
        return
      }

      const a = waiting
      waiting = null
      const b = {
        ws,
        name,
        role: /** @type {0|1} */ (1),
        inputs: new Map(),
      }
      const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0
      /** @type {Match} */
      const match = { seats: [a, b], nextTick: 0, finished: false }
      attach(a, match)
      attach(b, match)
      send(a.ws, {
        type: 'start',
        seed,
        you: 0,
        opponentName: b.name,
      })
      send(b.ws, {
        type: 'start',
        seed,
        you: 1,
        opponentName: a.name,
      })
      return
    }

    if (msg.type === 'input') {
      const match = /** @type {Match | undefined} */ (ws.__match)
      const seat = /** @type {Seat | undefined} */ (ws.__seat)
      if (!match || !seat) return
      onInput(match, msg.tick, msg.holding, seat)
      return
    }

    if (msg.type === 'finish') {
      const match = /** @type {Match | undefined} */ (ws.__match)
      if (match) match.finished = true
    }
  })

  ws.on('close', () => onClose(ws))
})

server.listen(PORT, () => {
  console.log(`wormular local API on http://127.0.0.1:${PORT}`)
})
