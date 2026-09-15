import type { ClientMsg, ServerMsg } from '../../shared/protocol'
import { sanitizeName } from '../../shared/protocol'

type Seat = {
  ws: WebSocket
  name: string
  role: 0 | 1
  inputs: Map<number, boolean>
  lastSeen: number
}

/**
 * Dual-purpose Durable Object:
 * - idFromName("queue") → matchmaking lobby (pairs two players in-place).
 * - idFromName("room:…") → live lockstep input relay for one match.
 */
export class MatchRoom implements DurableObject {
  private seats: Seat[] = []
  private mode: 'queue' | 'room' = 'queue'
  private started = false
  private finished = false
  private nextTickExpected = 0

  constructor(
    private readonly state: DurableObjectState,
    _env: { MATCH_ROOM: DurableObjectNamespace },
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    this.mode = url.pathname.startsWith('/ws/room/') ? 'room' : 'queue'

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== 'string') return
    let msg: ClientMsg
    try {
      msg = JSON.parse(message) as ClientMsg
    } catch {
      this.send(ws, { type: 'error', message: 'bad json' })
      return
    }

    if (msg.type === 'ping') {
      this.send(ws, { type: 'pong' })
      return
    }
    if (msg.type === 'hello') {
      this.onHello(ws, msg.name)
      return
    }
    if (msg.type === 'input') {
      this.onInput(ws, msg.tick, msg.holding)
      return
    }
    if (msg.type === 'finish') {
      this.finished = true
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const seat = this.seats.find((s) => s.ws === ws)
    this.seats = this.seats.filter((s) => s.ws !== ws)
    if (this.mode === 'room' && this.started && !this.finished && seat) {
      this.finished = true
      const winner = (seat.role === 0 ? 1 : 0) as 0 | 1
      this.broadcast({ type: 'forfeit', winner, reason: 'disconnect' })
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  private onHello(ws: WebSocket, rawName: string): void {
    const name = sanitizeName(rawName) ?? 'Player'
    if (this.seats.length >= 2) {
      this.send(ws, { type: 'error', message: 'full' })
      ws.close(1013, 'busy')
      return
    }
    const role = this.seats.length as 0 | 1
    this.seats.push({
      ws,
      name,
      role,
      inputs: new Map(),
      lastSeen: Date.now(),
    })

    if (this.seats.length < 2) {
      this.send(ws, { type: 'queued' })
      return
    }

    // Run the match on this DO once two players arrive (no second hop).
    this.mode = 'room'
    this.started = true
    this.nextTickExpected = 0
    const seed = (Date.now() ^ ((Math.random() * 0x7fffffff) >>> 0)) >>> 0
    const a = this.seats[0]!
    const b = this.seats[1]!
    this.send(a.ws, {
      type: 'start',
      seed,
      you: 0,
      opponentName: b.name,
    })
    this.send(b.ws, {
      type: 'start',
      seed,
      you: 1,
      opponentName: a.name,
    })
  }

  private onInput(ws: WebSocket, tick: number, holding: boolean): void {
    if (!this.started || this.finished) return
    if (!Number.isInteger(tick) || tick < 0 || tick > 1_000_000) return
    const seat = this.seats.find((s) => s.ws === ws)
    if (!seat) return
    seat.lastSeen = Date.now()
    // Overwrite until committed so clients can pipeline ahead.
    if (tick >= this.nextTickExpected) {
      seat.inputs.set(tick, !!holding)
    }

    if (this.seats.length < 2) return
    const a = this.seats[0]!
    const b = this.seats[1]!
    while (
      a.inputs.has(this.nextTickExpected) &&
      b.inputs.has(this.nextTickExpected)
    ) {
      const t = this.nextTickExpected
      const holdingPair: [boolean, boolean] = [
        a.inputs.get(t)!,
        b.inputs.get(t)!,
      ]
      a.inputs.delete(t)
      b.inputs.delete(t)
      this.broadcast({ type: 'inputs', tick: t, holding: holdingPair })
      this.nextTickExpected = t + 1
    }
  }

  private broadcast(msg: ServerMsg): void {
    for (const seat of this.seats) this.send(seat.ws, msg)
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // already closed
    }
  }
}
