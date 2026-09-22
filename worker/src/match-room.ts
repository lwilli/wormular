import type { ClientMsg, ServerMsg } from '../../shared/protocol'
import { sanitizeName } from '../../shared/protocol'

type SeatAttachment = {
  name: string
  role: 0 | 1
  /** Pending uncommitted inputs — survives hibernation. */
  inputs: Array<[number, boolean]>
  /** Copied onto each seat so wake can recover the lockstep cursor. */
  nextTickExpected: number
}

type RoomMeta = {
  mode: 'queue' | 'room'
  started: boolean
  finished: boolean
  nextTickExpected: number
}

type Seat = {
  ws: WebSocket
  name: string
  role: 0 | 1
  inputs: Map<number, boolean>
  lastSeen: number
}

const META_KEY = 'meta'

/**
 * Dual-purpose Durable Object:
 * - idFromName("queue") → matchmaking lobby (pairs two players in-place).
 * - idFromName("room:…") → live lockstep input relay for one match.
 *
 * Uses the hibernation WebSocket API. In-memory seats are rebuilt from
 * `serializeAttachment` + Durable Object storage after every wake — otherwise
 * the ~5s pre-battle countdown alone is enough idle time for Cloudflare to
 * hibernate the DO and drop subsequent inputs (match freezes after "Go!").
 */
export class MatchRoom implements DurableObject {
  private seats: Seat[] = []
  private mode: 'queue' | 'room' = 'queue'
  private started = false
  private finished = false
  private nextTickExpected = 0
  /** Keeps the DO warm while a match is live so input Maps are not wiped mid-fight. */
  private keepAlive: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly state: DurableObjectState,
    _env: { MATCH_ROOM: DurableObjectNamespace },
  ) {
    void this.state.blockConcurrencyWhile(async () => {
      await this.restoreFromHibernation()
    })
  }

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
    await this.ensureRestored()
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
      this.clearKeepAlive()
      void this.persistMeta()
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ensureRestored()
    const seat = this.seats.find((s) => s.ws === ws)
    this.seats = this.seats.filter((s) => s.ws !== ws)
    if (this.mode === 'room' && this.started && !this.finished && seat) {
      this.finished = true
      this.clearKeepAlive()
      void this.persistMeta()
      const winner = (seat.role === 0 ? 1 : 0) as 0 | 1
      this.broadcast({ type: 'forfeit', winner, reason: 'disconnect' })
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  private restored = false

  private async ensureRestored(): Promise<void> {
    if (this.restored) return
    await this.restoreFromHibernation()
  }

  private async restoreFromHibernation(): Promise<void> {
    const meta = (await this.state.storage.get<RoomMeta>(META_KEY)) ?? null
    if (meta) {
      this.mode = meta.mode
      this.started = meta.started
      this.finished = meta.finished
      this.nextTickExpected = meta.nextTickExpected
    }

    this.seats = []
    let attachedNext = meta?.nextTickExpected ?? 0
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as SeatAttachment | null
      if (!att || (att.role !== 0 && att.role !== 1)) continue
      if (typeof att.nextTickExpected === 'number') {
        attachedNext = Math.max(attachedNext, att.nextTickExpected)
      }
      this.seats.push({
        ws,
        name: att.name || 'Player',
        role: att.role,
        inputs: new Map(att.inputs ?? []),
        lastSeen: Date.now(),
      })
    }
    this.seats.sort((a, b) => a.role - b.role)
    this.nextTickExpected = attachedNext

    if (this.started && !this.finished) this.armKeepAlive()
    this.restored = true
  }

  private onHello(ws: WebSocket, rawName: string): void {
    const name = sanitizeName(rawName) ?? 'Player'
    if (this.seats.length >= 2) {
      this.send(ws, { type: 'error', message: 'full' })
      ws.close(1013, 'busy')
      return
    }
    // Re-hello from an already-seated socket (rare wake race) — ignore.
    if (this.seats.some((s) => s.ws === ws)) return

    const role = this.seats.length as 0 | 1
    const seat: Seat = {
      ws,
      name,
      role,
      inputs: new Map(),
      lastSeen: Date.now(),
    }
    this.seats.push(seat)
    this.writeAttachment(seat)

    if (this.seats.length < 2) {
      this.send(ws, { type: 'queued' })
      void this.persistMeta()
      return
    }

    // Run the match on this DO once two players arrive (no second hop).
    this.mode = 'room'
    this.started = true
    this.finished = false
    this.nextTickExpected = 0
    this.armKeepAlive()
    void this.persistMeta()
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
      this.writeAttachment(seat)
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
      this.writeAttachment(a)
      this.writeAttachment(b)
      this.broadcast({ type: 'inputs', tick: t, holding: holdingPair })
      this.nextTickExpected = t + 1
    }
    // Room meta (nextTick) stays in memory during the match; keepAlive
    // prevents hibernation so we do not rewrite storage every tick.
  }

  private writeAttachment(seat: Seat): void {
    const att: SeatAttachment = {
      name: seat.name,
      role: seat.role,
      inputs: [...seat.inputs.entries()],
      nextTickExpected: this.nextTickExpected,
    }
    try {
      seat.ws.serializeAttachment(att)
    } catch {
      // Socket already closed.
    }
  }

  private async persistMeta(): Promise<void> {
    const meta: RoomMeta = {
      mode: this.mode,
      started: this.started,
      finished: this.finished,
      nextTickExpected: this.nextTickExpected,
    }
    await this.state.storage.put(META_KEY, meta)
  }

  private armKeepAlive(): void {
    if (this.keepAlive != null) return
    // setInterval prevents hibernation while the match is in progress.
    this.keepAlive = setInterval(() => {
      // no-op heartbeat
    }, 1000)
  }

  private clearKeepAlive(): void {
    if (this.keepAlive == null) return
    clearInterval(this.keepAlive)
    this.keepAlive = null
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
