export type PlayMode = 'solo' | 'local' | 'online'

export type TitleUi = {
  setVisible: (visible: boolean) => void
  setHighScore: (score: number) => void
  setScore: (score: number) => void
  setHudVisible: (visible: boolean) => void
  setSfxEnabled: (enabled: boolean) => void
  setMusicEnabled: (enabled: boolean) => void
  onSfxToggle: (cb: () => void) => void
  onMusicToggle: (cb: () => void) => void
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
  /** Matchmaking / countdown overlay. Pass null to hide. */
  setMatchBanner: (title: string | null, count?: string | null) => void
}

const MODE_COPY: Record<
  PlayMode,
  { holdLines: string[]; hint: string }
> = {
  solo: {
    holdLines: ['to move out', 'release to fall in'],
    hint: 'Hold anywhere to start · thrust out · release to fall in',
  },
  local: {
    holdLines: ['to start local 1v1'],
    hint: 'Hold to start · release · then P0 hold / P1 hold W · first death loses',
  },
  online: {
    holdLines: ['to find an opponent'],
    hint: 'Hold to queue · matched countdown 5…1 · hold through Go to thrust · first death loses',
  },
}

export function bindTitleUi(): TitleUi {
  const title = mustHtml('#title')
  const highScore = mustHtml('#high-score')
  const sfxToggle = mustHtml('#sfx-toggle') as HTMLButtonElement
  const musicToggle = mustHtml('#music-toggle') as HTMLButtonElement
  const hud = mustHtml('#hud')
  const scoreEl = mustHtml('#score')
  const nickname = mustHtml('#nickname') as HTMLInputElement
  const boardList = mustHtml('#leaderboard-list')
  const boardStatus = mustHtml('#leaderboard-status')
  const menu = mustHtml('#menu')
  const status = mustHtml('#menu-status')
  const hint = mustHtml('#menu-hint')
  const holdSub = mustHtml('#hold-prompt-sub')
  const menuActions = mustHtml('#menu-actions')
  const menuCarousel = mustHtml('#menu-carousel')
  const soloBtn = mustHtml('#btn-solo') as HTMLButtonElement
  const localBtn = mustHtml('#btn-battle-local') as HTMLButtonElement
  const onlineBtn = mustHtml('#btn-battle-online') as HTMLButtonElement
  const modeButtons: { mode: PlayMode; btn: HTMLButtonElement }[] = [
    { mode: 'solo', btn: soloBtn },
    { mode: 'local', btn: localBtn },
    { mode: 'online', btn: onlineBtn },
  ]
  const indicators = Array.from(
    document.querySelectorAll('.menu-indicator'),
  ) as HTMLElement[]
  const battleHud = mustHtml('#battle-hud')
  const battleP0 = mustHtml('#battle-p0')
  const battleP1 = mustHtml('#battle-p1')
  const battleLabel = mustHtml('#battle-label')
  const result = mustHtml('#result')
  const matchBanner = mustHtml('#match-banner')
  const matchBannerTitle = mustHtml('#match-banner-title')
  const matchBannerCount = mustHtml('#match-banner-count')

  let playMode: PlayMode = 'solo'
  let currentIndex = 0
  const modeListeners: Array<(mode: PlayMode) => void> = []
  /** Pixel translate that puts the selected slide in the container center. */
  let restTranslateX = 0

  function selectedSlideCenterX(): number {
    const btn = modeButtons[currentIndex]?.btn
    if (!btn) return 0
    return btn.offsetLeft + btn.offsetWidth / 2
  }

  /** Center the selected slide in `.menu-actions`, independent of % padding math. */
  function centerSelectedSlide(): void {
    const viewportCenter = menuActions.clientWidth / 2
    restTranslateX = viewportCenter - selectedSlideCenterX()
    menuCarousel.style.transform = `translateX(${restTranslateX}px)`
  }

  function applyPlayMode(mode: PlayMode): void {
    playMode = mode
    currentIndex = Math.max(
      0,
      modeButtons.findIndex((m) => m.mode === mode),
    )

    for (const { mode: m, btn } of modeButtons) {
      const selected = m === mode
      btn.classList.toggle('is-selected', selected)
      btn.setAttribute('aria-selected', selected ? 'true' : 'false')
      btn.tabIndex = selected ? 0 : -1
    }

    for (let i = 0; i < indicators.length; i++) {
      indicators[i]!.classList.toggle('is-active', i === currentIndex)
    }

    const copy = MODE_COPY[mode]
    holdSub.replaceChildren(
      ...copy.holdLines.map((line) => {
        const span = document.createElement('span')
        span.textContent = line
        return span
      }),
    )
    hint.textContent = copy.hint
    centerSelectedSlide()
  }

  applyPlayMode('solo')
  requestAnimationFrame(centerSelectedSlide)

  let pointerId: number | null = null
  let dragStartX = 0
  let dragStartY = 0
  let dragging = false
  let dragLocked: 'h' | 'v' | null = null
  let suppressClick = false

  const onPointerDown = (e: PointerEvent) => {
    if (pointerId !== null) return
    e.stopPropagation()
    pointerId = e.pointerId
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragging = true
    dragLocked = null
    menuCarousel.style.transition = 'none'
    try {
      menuActions.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    e.stopPropagation()
    const deltaX = e.clientX - dragStartX
    const deltaY = e.clientY - dragStartY
    if (dragLocked === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      dragLocked = Math.abs(deltaX) >= Math.abs(deltaY) ? 'h' : 'v'
    }
    if (dragLocked !== 'h') return
    e.preventDefault()
    menuCarousel.style.transform = `translateX(${restTranslateX + deltaX}px)`
  }

  const finishDrag = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    e.stopPropagation()
    dragging = false
    pointerId = null
    menuCarousel.style.transition = ''
    const deltaX = e.clientX - dragStartX
    const threshold = Math.max(40, menuActions.clientWidth * 0.12)
    let next = currentIndex
    if (dragLocked === 'h') {
      if (deltaX > threshold && currentIndex > 0) next = currentIndex - 1
      else if (deltaX < -threshold && currentIndex < modeButtons.length - 1) {
        next = currentIndex + 1
      }
    }
    dragLocked = null
    const moved = Math.abs(deltaX) > 8
    const nextMode = modeButtons[next]?.mode ?? playMode
    if (nextMode !== playMode) {
      suppressClick = moved
      applyPlayMode(nextMode)
      for (const cb of modeListeners) cb(nextMode)
    } else {
      centerSelectedSlide()
    }
  }

  menuActions.addEventListener('pointerdown', onPointerDown)
  menuActions.addEventListener('pointermove', onPointerMove)
  menuActions.addEventListener('pointerup', finishDrag)
  menuActions.addEventListener('pointercancel', finishDrag)

  for (const { mode, btn } of modeButtons) {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (suppressClick) {
        suppressClick = false
        return
      }
      if (playMode === mode) return
      applyPlayMode(mode)
      for (const cb of modeListeners) cb(mode)
    })
  }

  const onResize = () => centerSelectedSlide()
  window.addEventListener('resize', onResize)
  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onResize)
      : null
  resizeObserver?.observe(menuActions)

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
        requestAnimationFrame(centerSelectedSlide)
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
    setMatchBanner(titleText, count) {
      if (!titleText) {
        matchBanner.hidden = true
        matchBannerTitle.textContent = ''
        matchBannerCount.textContent = ''
        return
      }
      matchBanner.hidden = false
      matchBannerTitle.textContent = titleText
      matchBannerCount.textContent = count ?? ''
      matchBannerCount.hidden = !count
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
