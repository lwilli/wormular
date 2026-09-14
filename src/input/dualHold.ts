/** Local 1v1: P0 = pointer/Space, P1 = KeyW. */

export type DualHoldInput = {
  holding: [boolean, boolean]
  playRequested: boolean
  destroy: () => void
}

export function createDualHoldInput(
  target: HTMLElement,
  opts?: { onPress?: () => void },
): DualHoldInput {
  const state: DualHoldInput = {
    holding: [false, false],
    playRequested: false,
    destroy: () => {},
  }

  const onPointerDown = (e: Event) => {
    e.preventDefault()
    state.holding[0] = true
    state.playRequested = true
    opts?.onPress?.()
  }
  const onPointerUp = (e: Event) => {
    e.preventDefault()
    state.holding[0] = false
  }
  const touchOpts: AddEventListenerOptions = { passive: false }
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    state.holding[0] = true
    state.playRequested = true
    opts?.onPress?.()
  }
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    state.holding[0] = false
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      state.holding[0] = true
      state.playRequested = true
      opts?.onPress?.()
    }
    if (e.code === 'KeyW') {
      e.preventDefault()
      state.holding[1] = true
      state.playRequested = true
      opts?.onPress?.()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      state.holding[0] = false
    }
    if (e.code === 'KeyW') {
      e.preventDefault()
      state.holding[1] = false
    }
  }
  const onContextMenu = (e: Event) => e.preventDefault()

  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('touchstart', onTouchStart, touchOpts)
  target.addEventListener('touchend', onTouchEnd, touchOpts)
  target.addEventListener('touchcancel', onTouchEnd, touchOpts)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  target.addEventListener('contextmenu', onContextMenu)

  state.destroy = () => {
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('touchstart', onTouchStart, touchOpts)
    target.removeEventListener('touchend', onTouchEnd, touchOpts)
    target.removeEventListener('touchcancel', onTouchEnd, touchOpts)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('contextmenu', onContextMenu)
  }

  return state
}
