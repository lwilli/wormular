/** Local 1v1: left half / Space = P0 (orange), right half / KeyW = P1 (teal). */

import { blurTextField, typingInField } from './textFocus'

export type DualHoldInput = {
  holding: [boolean, boolean]
  playRequested: boolean
  /** Drop all pointer / touch / key holds (e.g. when leaving a match). */
  reset: () => void
  destroy: () => void
}

/** Left half → seat 0 (orange), right half → seat 1 (teal). */
export function seatFromClientX(clientX: number, bounds: DOMRect): 0 | 1 {
  const mid = bounds.left + bounds.width * 0.5
  return clientX < mid ? 0 : 1
}

export function createDualHoldInput(
  target: HTMLElement,
  opts?: { onPress?: () => void },
): DualHoldInput {
  const state: DualHoldInput = {
    holding: [false, false],
    playRequested: false,
    reset: () => {},
    destroy: () => {},
  }

  /** Active pointer contacts (mouse / pen). Touch uses `touchSeats`. */
  const pointerSeats = new Map<number, 0 | 1>()
  /** Active touch.identifier → seat (multi-touch). */
  const touchSeats = new Map<number, 0 | 1>()
  const keyHolding: [boolean, boolean] = [false, false]

  const recompute = () => {
    const next: [boolean, boolean] = [keyHolding[0], keyHolding[1]]
    for (const seat of pointerSeats.values()) next[seat] = true
    for (const seat of touchSeats.values()) next[seat] = true
    state.holding[0] = next[0]
    state.holding[1] = next[1]
  }

  const reset = () => {
    pointerSeats.clear()
    touchSeats.clear()
    keyHolding[0] = false
    keyHolding[1] = false
    state.holding[0] = false
    state.holding[1] = false
    state.playRequested = false
  }
  state.reset = reset

  const bounds = () => target.getBoundingClientRect()

  const onPointerDown = (e: PointerEvent) => {
    // Touch contacts are owned by TouchEvent listeners so multitouch seats
    // stay correct even when browsers also synthesize pointer events.
    if (e.pointerType === 'touch') return
    e.preventDefault()
    blurTextField()
    const seat = seatFromClientX(e.clientX, bounds())
    pointerSeats.set(e.pointerId, seat)
    recompute()
    state.playRequested = true
    opts?.onPress?.()
  }
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    e.preventDefault()
    pointerSeats.delete(e.pointerId)
    recompute()
  }

  const touchOpts: AddEventListenerOptions = { passive: false }

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    blurTextField()
    const rect = bounds()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)
      if (!t) continue
      touchSeats.set(t.identifier, seatFromClientX(t.clientX, rect))
    }
    recompute()
    state.playRequested = true
    opts?.onPress?.()
  }
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)
      if (!t) continue
      touchSeats.delete(t.identifier)
    }
    recompute()
  }
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
  }
  const onGesture = (e: Event) => {
    e.preventDefault()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (typingInField()) return
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      keyHolding[0] = true
      recompute()
      state.playRequested = true
      opts?.onPress?.()
    }
    if (e.code === 'KeyW') {
      e.preventDefault()
      keyHolding[1] = true
      recompute()
      state.playRequested = true
      opts?.onPress?.()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (typingInField()) return
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      keyHolding[0] = false
      recompute()
    }
    if (e.code === 'KeyW') {
      e.preventDefault()
      keyHolding[1] = false
      recompute()
    }
  }
  const onContextMenu = (e: Event) => e.preventDefault()
  const onBlur = () => {
    reset()
  }

  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('touchstart', onTouchStart, touchOpts)
  target.addEventListener('touchmove', onTouchMove, touchOpts)
  target.addEventListener('touchend', onTouchEnd, touchOpts)
  target.addEventListener('touchcancel', onTouchEnd, touchOpts)
  target.addEventListener('gesturestart', onGesture)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  target.addEventListener('contextmenu', onContextMenu)

  state.destroy = () => {
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('touchstart', onTouchStart, touchOpts)
    target.removeEventListener('touchmove', onTouchMove, touchOpts)
    target.removeEventListener('touchend', onTouchEnd, touchOpts)
    target.removeEventListener('touchcancel', onTouchEnd, touchOpts)
    target.removeEventListener('gesturestart', onGesture)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    target.removeEventListener('contextmenu', onContextMenu)
  }

  return state
}
