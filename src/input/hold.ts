/** Pointer / keyboard → boolean holding. */

export type HoldInput = {
  holding: boolean
  /** True once if Play should start (title → playing). Cleared by consumer. */
  playRequested: boolean
}

export function createHoldInput(target: HTMLElement): HoldInput & {
  destroy: () => void
} {
  const state: HoldInput & { destroy: () => void } = {
    holding: false,
    playRequested: false,
    destroy: () => {},
  }

  const onDown = (e: Event) => {
    e.preventDefault()
    state.holding = true
  }
  const onUp = (e: Event) => {
    e.preventDefault()
    state.holding = false
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      state.holding = true
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      state.playRequested = true
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      state.holding = false
    }
  }

  const onContextMenu = (e: Event) => {
    e.preventDefault()
  }

  // Non-passive touch listeners: required for preventDefault to suppress iOS
  // Safari/Arc loupe / callout. Pointer alone is not enough there.
  const touchOpts: AddEventListenerOptions = { passive: false }
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    state.holding = true
  }
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    state.holding = false
  }
  const onGesture = (e: Event) => {
    e.preventDefault()
  }

  target.addEventListener('pointerdown', onDown)
  target.addEventListener('touchstart', onTouchStart, touchOpts)
  target.addEventListener('touchmove', onGesture, touchOpts)
  target.addEventListener('touchend', onTouchEnd, touchOpts)
  target.addEventListener('touchcancel', onTouchEnd, touchOpts)
  target.addEventListener('gesturestart', onGesture)
  target.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  state.destroy = () => {
    target.removeEventListener('pointerdown', onDown)
    target.removeEventListener('touchstart', onTouchStart, touchOpts)
    target.removeEventListener('touchmove', onGesture, touchOpts)
    target.removeEventListener('touchend', onTouchEnd, touchOpts)
    target.removeEventListener('touchcancel', onTouchEnd, touchOpts)
    target.removeEventListener('gesturestart', onGesture)
    target.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  return state
}
