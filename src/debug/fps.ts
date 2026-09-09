/** Dev-only FPS HUD. Tree-shaken / inert in production builds. */

export type FpsSample = {
  /** Time spent in sim this frame (ms). */
  simMs: number
  /** Time spent drawing this frame (ms). */
  drawMs: number
  extra?: string
}

export type FpsMeter = {
  frame: (ts: number, sample: FpsSample) => void
  dispose: () => void
}

export function createFpsMeter(parent: HTMLElement = document.body): FpsMeter {
  if (!import.meta.env.DEV) {
    return { frame() {}, dispose() {} }
  }

  document.getElementById('fps-meter')?.remove()

  const el = document.createElement('div')
  el.id = 'fps-meter'
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    left: 'max(0.5rem, env(safe-area-inset-left))',
    bottom: 'max(0.5rem, env(safe-area-inset-bottom))',
    zIndex: '9999',
    padding: '0.2rem 0.45rem',
    borderRadius: '4px',
    background: 'rgba(0,0,0,0.55)',
    color: '#9fe870',
    font: '12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
    pointerEvents: 'none',
    userSelect: 'none',
  })
  parent.appendChild(el)

  let frames = 0
  let windowStart = 0
  let lastWarn = 0
  let lastTs = 0
  let gapMsEma = 16
  let simMsEma = 0
  let drawMsEma = 0
  let lastExtra = ''

  return {
    frame(ts, sample) {
      if (lastTs) gapMsEma = gapMsEma * 0.9 + (ts - lastTs) * 0.1
      lastTs = ts
      simMsEma = simMsEma * 0.9 + sample.simMs * 0.1
      drawMsEma = drawMsEma * 0.9 + sample.drawMs * 0.1
      lastExtra = sample.extra ?? ''

      if (!windowStart) windowStart = ts
      frames++
      const elapsed = ts - windowStart
      if (elapsed >= 500) {
        const fps = (frames * 1000) / elapsed
        frames = 0
        windowStart = ts
        const rounded = Math.round(fps)
        el.textContent = [
          `${rounded} fps`,
          `gap ${gapMsEma.toFixed(0)}`,
          `sim ${simMsEma.toFixed(1)}`,
          `draw ${drawMsEma.toFixed(1)}`,
          lastExtra,
        ]
          .filter(Boolean)
          .join(' · ')
        el.style.color = rounded < 50 ? '#ff6b6b' : '#9fe870'

        if (rounded < 50 && ts - lastWarn > 5000) {
          lastWarn = ts
          console.warn(`[fps] ${el.textContent}`)
        }
      }
    },
    dispose() {
      el.remove()
    },
  }
}
