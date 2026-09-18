import type { PresenceClientMsg, PresenceServerMsg } from '../../shared/protocol'
import { apiBase } from '../platform/leaderboard'

export type PresenceHandlers = {
  onCount?: (online: number) => void
  onClose?: () => void
}

export type PresenceClient = {
  close: () => void
}

function presenceWsUrl(): string {
  const base = apiBase()
  if (base.startsWith('http://') || base.startsWith('https://')) {
    const u = new URL(base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `${u.pathname.replace(/\/$/, '')}/ws/presence`
    return u.toString()
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = base.startsWith('/') ? base : `/${base}`
  return `${proto}//${location.host}${path.replace(/\/$/, '')}/ws/presence`
}

/** Hold open while Online 1v1 is selected; server pushes live lobby count. */
export function connectPresence(handlers: PresenceHandlers): PresenceClient {
  const ws = new WebSocket(presenceWsUrl())
  let closed = false
  let pingTimer = 0

  ws.addEventListener('open', () => {
    pingTimer = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      const msg: PresenceClientMsg = { type: 'ping' }
      try {
        ws.send(JSON.stringify(msg))
      } catch {
        // ignore
      }
    }, 25_000)
  })

  ws.addEventListener('message', (ev) => {
    let msg: PresenceServerMsg
    try {
      msg = JSON.parse(String(ev.data)) as PresenceServerMsg
    } catch {
      return
    }
    if (msg.type === 'presence') {
      handlers.onCount?.(msg.online)
    }
  })

  ws.addEventListener('close', () => {
    if (pingTimer) window.clearInterval(pingTimer)
    pingTimer = 0
    if (!closed) handlers.onClose?.()
  })

  return {
    close() {
      closed = true
      if (pingTimer) window.clearInterval(pingTimer)
      pingTimer = 0
      try {
        ws.close()
      } catch {
        // ignore
      }
    },
  }
}
