export type PlayMode = 'solo' | 'local' | 'online'

export type TitleUi = {
  setVisible: (visible: boolean) => void
  setHighScore: (score: number) => void
  setScore: (score: number) => void
  setHudVisible: (visible: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  onSoundToggle: (cb: () => void) => void
  setNickname: (name: string) => void
  getNickname: () => string
  onNicknameChange: (cb: (name: string) => void) => void
  setLeaderboard: (
    rows: { name: string; score: number }[],
    status?: string,
  ) => void
  setMenuVisible: (visible: boolean) => void
  setStatus: (text: string) => void
  setPlayMode: (mode: PlayMode) => void
  getPlayMode: () => PlayMode
  onPlayModeChange: (cb: (mode: PlayMode) => void) => void
  setBattleHud: (p0: number, p1: number, label?: string) => void
  setResult: (text: string | null) => void
}

const MODE_COPY: Record<
  PlayMode,
  { holdSub: string; hint: string }
> = {
  solo: {
    holdSub: 'to move out · release to fall in',
    hint: 'Hold anywhere to start · thrust out · release to fall in',
  },
  local: {
    holdSub: 'to start local 1v1',
    hint: 'Hold to start · release · then P0 hold / P1 hold W · first death loses',
  },
  online: {
    holdSub: 'to find an opponent',
    hint: 'Hold to queue · release when matched · then thrust as usual · first death loses',
  },
}

export function bindTitleUi(): TitleUi {
  const title = mustHtml('#title')
  const highScore = mustHtml('#high-score')
  const soundToggle = mustHtml('#sound-toggle') as HTMLButtonElement
  const hud = mustHtml('#hud')
  const scoreEl = mustHtml('#score')
  const nickname = mustHtml('#nickname') as HTMLInputElement
  const boardList = mustHtml('#leaderboard-list')
  const boardStatus = mustHtml('#leaderboard-status')
  const menu = mustHtml('#menu')
  const status = mustHtml('#menu-status')
  const hint = mustHtml('#menu-hint')
  const holdSub = mustHtml('#hold-prompt-sub')
  const soloBtn = mustHtml('#btn-solo') as HTMLButtonElement
  const localBtn = mustHtml('#btn-battle-local') as HTMLButtonElement
  const onlineBtn = mustHtml('#btn-battle-online') as HTMLButtonElement
  const modeButtons: { mode: PlayMode; btn: HTMLButtonElement }[] = [
    { mode: 'solo', btn: soloBtn },
    { mode: 'local', btn: localBtn },
    { mode: 'online', btn: onlineBtn },
  ]
  const battleHud = mustHtml('#battle-hud')
  const battleP0 = mustHtml('#battle-p0')
  const battleP1 = mustHtml('#battle-p1')
  const battleLabel = mustHtml('#battle-label')
  const result = mustHtml('#result')

  let playMode: PlayMode = 'solo'
  const modeListeners: Array<(mode: PlayMode) => void> = []

  function applyPlayMode(mode: PlayMode): void {
    playMode = mode
    for (const { mode: m, btn } of modeButtons) {
      const selected = m === mode
      btn.classList.toggle('is-selected', selected)
      btn.setAttribute('aria-selected', selected ? 'true' : 'false')
    }
    const copy = MODE_COPY[mode]
    holdSub.textContent = copy.holdSub
    hint.textContent = copy.hint
  }

  // Default until main restores the sticky selection via setPlayMode.
  applyPlayMode('solo')

  for (const { mode, btn } of modeButtons) {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (playMode === mode) return
      applyPlayMode(mode)
      for (const cb of modeListeners) cb(mode)
    })
  }

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
    setNickname(name) {
      nickname.value = name
    },
    getNickname() {
      return nickname.value
    },
    onNicknameChange(cb) {
      const fire = () => cb(nickname.value)
      nickname.addEventListener('change', fire)
      nickname.addEventListener('blur', fire)
    },
    setLeaderboard(rows, statusText) {
      boardList.replaceChildren()
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const li = document.createElement('li')
        li.textContent = `${i + 1}. ${row.name} — ${row.score}`
        boardList.appendChild(li)
      }
      boardStatus.textContent =
        statusText ?? (rows.length ? '' : 'No scores yet')
    },
    setMenuVisible(visible) {
      menu.hidden = !visible
    },
    setStatus(text) {
      status.textContent = text
      status.hidden = !text
    },
    setPlayMode(mode) {
      applyPlayMode(mode)
    },
    getPlayMode() {
      return playMode
    },
    onPlayModeChange(cb) {
      modeListeners.push(cb)
    },
    setBattleHud(p0, p1, label) {
      battleHud.hidden = false
      battleP0.textContent = String(p0)
      battleP1.textContent = String(p1)
      battleLabel.textContent = label ?? 'Battle'
    },
    setResult(text) {
      if (!text) {
        result.hidden = true
        result.textContent = ''
        return
      }
      result.hidden = false
      result.textContent = text
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
