export type TitleUi = {
  setVisible: (visible: boolean) => void
  setHighScore: (score: number) => void
  setScore: (score: number) => void
  setHudVisible: (visible: boolean) => void
  onPlay: (cb: () => void) => void
}

export function bindTitleUi(): TitleUi {
  const title = must('#title')
  const highScore = must('#high-score')
  const play = must('#play') as HTMLButtonElement
  const hud = must('#hud')
  const scoreEl = must('#score')

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
    onPlay(cb) {
      play.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        cb()
      })
    },
  }
}

function must(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Missing element ${sel}`)
  }
  return el
}
