export type TitleUi = {
  setVisible: (visible: boolean) => void
  setHighScore: (score: number) => void
  setScore: (score: number) => void
  setHudVisible: (visible: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  onSoundToggle: (cb: () => void) => void
}

export function bindTitleUi(): TitleUi {
  const title = mustHtml('#title')
  const highScore = mustHtml('#high-score')
  const soundToggle = mustHtml('#sound-toggle') as HTMLButtonElement
  const hud = mustHtml('#hud')
  const scoreEl = mustHtml('#score')

  return {
    setVisible(visible) {
      title.hidden = !visible
      title.classList.toggle('hidden', !visible)
    },
    setHighScore(score) {
      highScore.textContent = `High Score: ${score}`
    },
    setScore(score) {
      scoreEl.textContent = String(score)
    },
    setHudVisible(visible) {
      hud.hidden = !visible
    },
    setSoundEnabled(enabled) {
      const muted = !enabled
      soundToggle.classList.toggle('is-muted', muted)
      soundToggle.setAttribute('aria-pressed', muted ? 'true' : 'false')
      soundToggle.setAttribute(
        'aria-label',
        muted ? 'Unmute sound' : 'Mute sound',
      )
      soundToggle.title = muted ? 'Sound off' : 'Sound on'
    },
    onSoundToggle(cb) {
      soundToggle.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        cb()
      })
    },
  }
}

function mustHtml(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Missing element ${sel}`)
  }
  return el
}
