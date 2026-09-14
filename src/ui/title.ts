export type TitleUi = {
  setVisible: (visible: boolean) => void
  setHighScore: (score: number) => void
  setScore: (score: number) => void
  setHudVisible: (visible: boolean) => void
  setSfxEnabled: (enabled: boolean) => void
  setMusicEnabled: (enabled: boolean) => void
  onSfxToggle: (cb: () => void) => void
  onMusicToggle: (cb: () => void) => void
}

export function bindTitleUi(): TitleUi {
  const title = mustHtml('#title')
  const highScore = mustHtml('#high-score')
  const sfxToggle = mustHtml('#sfx-toggle') as HTMLButtonElement
  const musicToggle = mustHtml('#music-toggle') as HTMLButtonElement
  const hud = mustHtml('#hud')
  const scoreEl = mustHtml('#score')

  return {
    setVisible(visible) {
      if (visible) {
        const needsFade = title.hidden || title.classList.contains('hidden')
        title.hidden = false
        title.classList.remove('hidden')
        if (needsFade) {
          // Death → title: start transparent, then fade chrome in.
          title.classList.remove('is-shown')
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!title.hidden) title.classList.add('is-shown')
            })
          })
        } else {
          title.classList.add('is-shown')
        }
      } else {
        title.classList.remove('is-shown')
        title.hidden = true
        title.classList.add('hidden')
      }
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
    setSfxEnabled(enabled) {
      syncMuteButton(sfxToggle, enabled, {
        mutedLabel: 'Unmute sound effects',
        unmutedLabel: 'Mute sound effects',
        mutedTitle: 'SFX off',
        unmutedTitle: 'SFX on',
      })
    },
    setMusicEnabled(enabled) {
      syncMuteButton(musicToggle, enabled, {
        mutedLabel: 'Unmute music',
        unmutedLabel: 'Mute music',
        mutedTitle: 'Music off',
        unmutedTitle: 'Music on',
      })
    },
    onSfxToggle(cb) {
      bindToggleClick(sfxToggle, cb)
    },
    onMusicToggle(cb) {
      bindToggleClick(musicToggle, cb)
    },
  }
}

function syncMuteButton(
  btn: HTMLButtonElement,
  enabled: boolean,
  labels: {
    mutedLabel: string
    unmutedLabel: string
    mutedTitle: string
    unmutedTitle: string
  },
): void {
  const muted = !enabled
  btn.classList.toggle('is-muted', muted)
  btn.setAttribute('aria-pressed', muted ? 'true' : 'false')
  btn.setAttribute('aria-label', muted ? labels.mutedLabel : labels.unmutedLabel)
  btn.title = muted ? labels.mutedTitle : labels.unmutedTitle
}

function bindToggleClick(btn: HTMLButtonElement, cb: () => void): void {
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    cb()
  })
}

function mustHtml(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Missing element ${sel}`)
  }
  return el
}
