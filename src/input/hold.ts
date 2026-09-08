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

  target.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  state.destroy = () => {
    target.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  return state
}
