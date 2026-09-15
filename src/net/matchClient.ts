import type { ClientMsg, ServerMsg } from '../../shared/protocol'
import { apiBase } from '../platform/leaderboard'

export type MatchHandlers = {
  onQueued?: () => void
  onStart?: (info: {
    seed: number
    you: 0 | 1
    opponentName: string
  }) => void
  onInputs?: (tick: number, holding: [boolean, boolean]) => void
  onForfeit?: (winner: 0 | 1, reason: string) => void
  onError?: (message: string) => void
  onClose?: () => void
}

export type MatchClient = {
  sendInput: (tick: number, holding: boolean) => void
  /** Mark the match finished before close so the peer is not forfeited. */
  finish: () => void
  close: () => void
}

function wsUrl(): string {
  const base = apiBase()
  if (base.startsWith('http://') || base.startsWith('https://')) {
    const u = new URL(base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `${u.pathname.replace(/\/$/, '')}/ws/match`
    return u.toString()
  }
  // Same-origin relative `/api` → ws(s)://host/api/ws/match
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = base.startsWith('/') ? base : `/${base}`
  return `${proto}//${location.host}${path.replace(/\/$/, '')}/ws/match`
}

export function connectMatch(name: string, handlers: MatchHandlers): MatchClient {
  const ws = new WebSocket(wsUrl())
  let closed = false

  ws.addEventListener('open', () => {
    const msg: ClientMsg = { type: 'hello', name }
    ws.send(JSON.stringify(msg))
  })

  ws.addEventListener('message', (ev) => {
    let msg: ServerMsg
    try {
      msg = JSON.parse(String(ev.data)) as ServerMsg
    } catch {
      return
    }
    switch (msg.type) {
      case 'queued':
        handlers.onQueued?.()
        break
      case 'start':
        handlers.onStart?.({
          seed: msg.seed,
          you: msg.you,
          opponentName: msg.opponentName,
        })
        break
      case 'inputs':
        handlers.onInputs?.(msg.tick, msg.holding)
        break
      case 'forfeit':
        handlers.onForfeit?.(msg.winner, msg.reason)
        break
      case 'error':
        handlers.onError?.(msg.message)
        break
      default:
        break
    }
  })

  ws.addEventListener('close', () => {
    if (!closed) handlers.onClose?.()
  })

  return {
    sendInput(tick, holding) {
      if (ws.readyState !== WebSocket.OPEN) return
      const msg: ClientMsg = { type: 'input', tick, holding }
      ws.send(JSON.stringify(msg))
    },
    finish() {
      if (ws.readyState !== WebSocket.OPEN) return
      const msg: ClientMsg = { type: 'finish' }
      try {
        ws.send(JSON.stringify(msg))
      } catch {
        // ignore
      }
    },
    close() {
      closed = true
      try {
        ws.close()
      } catch {
        // ignore
      }
    },
  }
}
