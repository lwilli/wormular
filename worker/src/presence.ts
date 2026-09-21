/**
 * Live lobby presence: one Durable Object (`idFromName("lobby")`) tracks
 * open WebSockets from clients browsing Online 1v1 and broadcasts the count.
 */
export class Presence implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)
    this.broadcast()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    let msg: { type?: string }
    try {
      msg = JSON.parse(message) as { type?: string }
    } catch {
      return
    }
    if (msg.type === 'ping') {
      try {
        ws.send(JSON.stringify({ type: 'pong' }))
      } catch {
        // already closed
      }
    }
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    this.broadcast()
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'error')
    } catch {
      // already closed
    }
    this.broadcast()
  }

  private broadcast(): void {
    const sockets = this.state.getWebSockets()
    const payload = JSON.stringify({ type: 'presence', online: sockets.length })
    for (const ws of sockets) {
      try {
        ws.send(payload)
      } catch {
        // already closed
      }
    }
  }
}
