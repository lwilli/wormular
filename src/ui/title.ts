export type PlayMode = 'solo' | 'local' | 'online'

/** Center-prompt matchmaking copy for Online 1v1. */
export type MatchStatus =
  | 'idle'
  | 'finding'
  | 'waiting'
  | { error: string }

export type PlayModeChangeMeta = {
  animate: boolean
  /** +1 = toward Online (next), -1 = toward Solo (prev). */
  dir: 1 | -1
}

/** Keep in sync with `--orbit-ms` in `src/style.css`. */
export const MODE_ORBIT_MS = 420

export type TitleUi = {
  setVisible: (visible: boolean, opts?: { fadeMs?: number }) => void
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
  /** Online 1v1 ready / queue / error — always the center prompt. */
  setMatchStatus: (state: MatchStatus) => void
  /** Live lobby presence count under the Online nickname field. */
  setOnlineCount: (n: number | null) => void
  setPlayMode: (mode: PlayMode) => void
  getPlayMode: () => PlayMode
  onPlayModeChange: (
    cb: (mode: PlayMode, meta: PlayModeChangeMeta) => void,
  ) => void
  /** Fires when a horizontal swipe is recognized (start should be cancelled). */
  onCarouselGesture: (cb: () => void) => void
  /**
   * Title canvas press may become a swipe — defer starting until commit/cancel.
   * `defer` on pointerdown, `commit` for tap / press-and-hold, `cancel` on swipe.
   */
  onTitlePressGesture: (cb: (phase: 'defer' | 'commit' | 'cancel') => void) => void
  setBattleHud: (p0: number, p1: number, label?: string) => void
  setResult: (text: string | null) => void
  /** Matchmaking / countdown overlay. Pass null to hide. */
  setMatchBanner: (title: string | null, count?: string | null) => void
}

export const PLAY_MODES: PlayMode[] = ['solo', 'local', 'online']

/** Neighbor in the wrapping carousel (−1 prev, +1 next). */
export function neighborPlayMode(mode: PlayMode, delta: -1 | 1): PlayMode {
  const i = PLAY_MODES.indexOf(mode)
  const n = PLAY_MODES.length
  return PLAY_MODES[((i + delta) % n + n) % n]!
}

const MODE_COPY: Record<
  PlayMode,
  {
    title: string
    tagline: string
    shortLabel: string
    promptMain: string
    promptLines: string[]
  }
> = {
  solo: {
    title: 'SOLO',
    tagline: '',
    shortLabel: 'Solo',
    promptMain: 'Press & Hold',
    promptLines: ['to move out', 'release to fall in'],
  },
  local: {
    title: 'LOCAL 1v1',
    tagline: 'Top / bottom · first death loses',
    shortLabel: 'Local',
    promptMain: 'Tap to Start',
    promptLines: [],
  },
  online: {
    title: 'ONLINE 1v1',
    tagline: 'Match a stranger · first death loses',
    shortLabel: 'Online',
    promptMain: 'Tap to find an opponent',
    promptLines: [],
  },
}

const SWIPE_THRESHOLD_PX = 48
/** Ignore tiny jitter when deciding a press-and-hold can start. */
const TAP_SLOP_PX = 14
/** Solo Press & Hold: allow start after this if the finger has not slid. */
const HOLD_COMMIT_MS = 120

export function bindTitleUi(): TitleUi {
  const title = mustHtml('#title')
  const carousel = mustHtml('#mode-carousel')
  const modeCaption = mustHtml('.mode-caption')
  const titleBottom = mustHtml('.title-bottom')
  const highScore = mustHtml('#high-score')
  const sfxToggle = mustHtml('#sfx-toggle') as HTMLButtonElement
  const musicToggle = mustHtml('#music-toggle') as HTMLButtonElement
  const hud = mustHtml('#hud')
  const scoreEl = mustHtml('#score')
  const nicknameField = mustHtml('#nickname-field')
  const nickname = mustHtml('#nickname') as HTMLInputElement
  const boardList = mustHtml('#leaderboard-list')
  const boardStatus = mustHtml('#leaderboard-status')
  const menu = mustHtml('#menu')
  const status = mustHtml('#menu-status')
  const holdMain = mustHtml('#hold-prompt-main')
  const holdSub = mustHtml('#hold-prompt-sub')
  const modeTitle = mustHtml('#mode-title')
  const modeTagline = mustHtml('#mode-tagline')
  const panelSolo = mustHtml('#panel-solo')
  const panelLocal = mustHtml('#panel-local')
  const panelOnline = mustHtml('#panel-online')
  const onlineCount = mustHtml('#online-count')
  const peekPrev = mustHtml('#mode-peek-prev') as HTMLButtonElement
  const peekNext = mustHtml('#mode-peek-next') as HTMLButtonElement
  const peekPrevLabel = mustHtml('#mode-peek-prev-label')
  const peekNextLabel = mustHtml('#mode-peek-next-label')
  const battleHud = mustHtml('#battle-hud')
  const battleP0 = mustHtml('#battle-p0')
  const battleP1 = mustHtml('#battle-p1')
  const battleLabel = mustHtml('#battle-label')
  const localScoreP0 = mustHtml('#local-score-p0')
  const localScoreP1 = mustHtml('#local-score-p1')
  const localBannerP0 = mustHtml('#local-banner-p0')
  const localBannerP1 = mustHtml('#local-banner-p1')
  const localResultP0 = mustHtml('#local-result-p0')
  const localResultP1 = mustHtml('#local-result-p1')
  const result = mustHtml('#result')
  const matchBanner = mustHtml('#match-banner')
  const matchBannerTitle = mustHtml('#match-banner-title')
  const matchBannerCount = mustHtml('#match-banner-count')

  function setLocalBanners(titleText: string | null, count?: string | null): void {
    for (const banner of [localBannerP0, localBannerP1]) {
      const titleEl = banner.querySelector('.local-banner-title') as HTMLElement | null
      const countEl = banner.querySelector('.local-banner-count') as HTMLElement | null
      if (!titleText) {
        banner.hidden = true
        if (titleEl) titleEl.textContent = ''
        if (countEl) countEl.textContent = ''
        continue
      }
      banner.hidden = false
      if (titleEl) titleEl.textContent = titleText
      if (countEl) {
        countEl.textContent = count ?? ''
        countEl.hidden = !count
      }
    }
  }

  function setLocalResults(text: string | null): void {
    for (const el of [localResultP0, localResultP1]) {
      if (!text) {
        el.hidden = true
        el.textContent = ''
      } else {
        el.hidden = false
        el.textContent = text
      }
    }
  }

  let playMode: PlayMode = 'solo'
  let menuVisible = true
  let transitioning = false
  let finishTimer = 0
  let hideFadeTimer = 0
  const modeListeners: Array<(mode: PlayMode, meta: PlayModeChangeMeta) => void> =
    []
  const gestureListeners: Array<() => void> = []
  const pressGestureListeners: Array<
    (phase: 'defer' | 'commit' | 'cancel') => void
  > = []
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function modeIndex(mode: PlayMode): number {
    return PLAY_MODES.indexOf(mode)
  }

  /** Always returns a neighbor — carousel wraps. */
  function neighbor(delta: -1 | 1): PlayMode {
    return neighborPlayMode(playMode, delta)
  }

  /** Shortest wrap direction from → to (−1 prev, +1 next). */
  function shortestDir(from: PlayMode, to: PlayMode): 1 | -1 {
    const a = modeIndex(from)
    const b = modeIndex(to)
    const n = PLAY_MODES.length
    const forward = (b - a + n) % n
    const backward = (a - b + n) % n
    if (forward === 0) return 1
    return forward <= backward ? 1 : -1
  }

  function clearModeAnimClasses(): void {
    modeCaption.classList.remove(
      'mode-anim-out-left',
      'mode-anim-out-right',
      'mode-anim-in-left',
      'mode-anim-in-right',
    )
    titleBottom.classList.remove(
      'mode-anim-out-left',
      'mode-anim-out-right',
      'mode-anim-in-left',
      'mode-anim-in-right',
    )
    holdSub.classList.remove('mode-anim-fade-out', 'mode-anim-fade-in')
    carousel.classList.remove('is-sliding-next', 'is-sliding-prev')
  }

  function applyPeekChrome(): void {
    const prev = neighbor(-1)
    const next = neighbor(1)
    peekPrev.hidden = false
    peekNext.hidden = false
    peekPrev.disabled = transitioning
    peekNext.disabled = transitioning
    peekPrevLabel.textContent = MODE_COPY[prev].shortLabel
    peekNextLabel.textContent = MODE_COPY[next].shortLabel
    peekPrev.setAttribute('aria-label', MODE_COPY[prev].title)
    peekNext.setAttribute('aria-label', MODE_COPY[next].title)
    peekPrev.dataset.peekMode = prev
    peekNext.dataset.peekMode = next
  }

  function paintHoldPrompt(main: string, lines: string[]): void {
    holdMain.textContent = main
    holdSub.replaceChildren(
      ...lines.map((line) => {
        const span = document.createElement('span')
        span.textContent = line
        return span
      }),
    )
    holdSub.hidden = lines.length === 0
  }

  function paintModeHoldPrompt(): void {
    const copy = MODE_COPY[playMode]
    paintHoldPrompt(copy.promptMain, copy.promptLines)
    title.classList.remove('is-matching')
  }

  function applyPlayMode(mode: PlayMode, opts?: { peeks?: boolean }): void {
    playMode = mode
    const copy = MODE_COPY[mode]
    modeTitle.textContent = copy.title
    modeTagline.textContent = copy.tagline
    paintModeHoldPrompt()

    panelSolo.hidden = mode !== 'solo'
    panelLocal.hidden = mode !== 'local'
    panelOnline.hidden = mode !== 'online'
    nicknameField.hidden = mode === 'local'

    title.dataset.playMode = mode
    if (opts?.peeks !== false) applyPeekChrome()
  }

  function commitMode(
    mode: PlayMode,
    meta: PlayModeChangeMeta,
    opts?: { peeks?: boolean },
  ): void {
    applyPlayMode(mode, opts)
    for (const cb of modeListeners) cb(mode, meta)
  }

  function selectMode(
    mode: PlayMode,
    opts?: { animate?: boolean; dir?: 1 | -1 },
  ): void {
    if (playMode === mode || transitioning) return
    const animate = opts?.animate !== false && !reduceMotion.matches
    const dir: 1 | -1 = opts?.dir ?? shortestDir(playMode, mode)

    if (!animate) {
      window.clearTimeout(finishTimer)
      clearModeAnimClasses()
      transitioning = false
      commitMode(mode, { animate: false, dir })
      return
    }

    transitioning = true
    window.clearTimeout(finishTimer)
    clearModeAnimClasses()

    peekPrev.hidden = false
    peekNext.hidden = false
    peekPrev.disabled = true
    peekNext.disabled = true

    // Commit immediately so main can render both arenas sliding live.
    carousel.classList.add(dir > 0 ? 'is-sliding-next' : 'is-sliding-prev')
    commitMode(mode, { animate: true, dir }, { peeks: false })
    modeCaption.classList.add(dir > 0 ? 'mode-anim-in-right' : 'mode-anim-in-left')
    titleBottom.classList.add(dir > 0 ? 'mode-anim-in-right' : 'mode-anim-in-left')
    holdSub.classList.add('mode-anim-fade-in')

    finishTimer = window.setTimeout(() => {
      clearModeAnimClasses()
      transitioning = false
      applyPeekChrome()
    }, MODE_ORBIT_MS)
  }

  function stepMode(delta: -1 | 1): void {
    selectMode(neighbor(delta), { dir: delta })
  }

  // Default until main restores the sticky selection via setPlayMode.
  applyPlayMode('solo')

  peekPrev.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    stepMode(-1)
  })
  peekNext.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    stepMode(1)
  })

  // Horizontal swipe on the title surface switches modes without starting.
  // Presses are deferred until we know they are a tap / hold, not a swipe —
  // otherwise the first rAF after pointerdown starts the run.
  let swipePointerId: number | null = null
  let swipeStartX = 0
  let swipeStartY = 0
  let swipeLastX = 0
  let swipeLastY = 0
  let swipeArmed = false
  let swipeConsumed = false
  let holdCommitTimer = 0

  function isChromeTarget(t: EventTarget | null): boolean {
    if (!(t instanceof Element)) return false
    return Boolean(
      t.closest(
        'button, input, label, a, .menu, .orbit-disk, .audio-toggles, .nickname-field',
      ),
    )
  }

  function notifyCarouselGesture(): void {
    for (const cb of gestureListeners) cb()
  }

  function notifyPressGesture(phase: 'defer' | 'commit' | 'cancel'): void {
    for (const cb of pressGestureListeners) cb(phase)
  }

  function clearHoldCommitTimer(): void {
    if (holdCommitTimer) {
      window.clearTimeout(holdCommitTimer)
      holdCommitTimer = 0
    }
  }

  function horizontalTravel(): number {
    return Math.abs(swipeLastX - swipeStartX)
  }

  function verticalTravel(): number {
    return Math.abs(swipeLastY - swipeStartY)
  }

  /** True when the finger has slid enough that a swipe may still be forming. */
  function swipeInProgress(): boolean {
    const dx = horizontalTravel()
    const dy = verticalTravel()
    return dx >= TAP_SLOP_PX && dx >= dy * 0.85
  }

  function commitPressIfStill(): void {
    if (!swipeArmed || swipeConsumed) return
    if (swipeInProgress()) return
    swipeArmed = false
    clearHoldCommitTimer()
    notifyPressGesture('commit')
  }

  function onPointerDown(e: PointerEvent): void {
    if (!menuVisible || title.hidden) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (isChromeTarget(e.target)) return
    swipePointerId = e.pointerId
    swipeStartX = e.clientX
    swipeStartY = e.clientY
    swipeLastX = e.clientX
    swipeLastY = e.clientY
    swipeArmed = true
    swipeConsumed = false
    notifyPressGesture('defer')
    clearHoldCommitTimer()
    holdCommitTimer = window.setTimeout(() => {
      holdCommitTimer = 0
      commitPressIfStill()
    }, HOLD_COMMIT_MS)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!swipeArmed || e.pointerId !== swipePointerId || swipeConsumed) return
    swipeLastX = e.clientX
    swipeLastY = e.clientY
    const dx = e.clientX - swipeStartX
    const dy = e.clientY - swipeStartY
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (Math.abs(dx) < Math.abs(dy) * 1.15) return
    swipeConsumed = true
    swipeArmed = false
    clearHoldCommitTimer()
    // Always cancel start — even when already at the first/last mode.
    notifyPressGesture('cancel')
    notifyCarouselGesture()
    stepMode(dx < 0 ? 1 : -1)
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== swipePointerId) return
    swipePointerId = null
    clearHoldCommitTimer()
    if (swipeConsumed) {
      swipeArmed = false
      return
    }
    if (!swipeArmed) return
    swipeArmed = false
    if (horizontalTravel() < SWIPE_THRESHOLD_PX) {
      // Tap or short press: allow start (playRequested may still be set).
      notifyPressGesture('commit')
    } else {
      // Large drag that never met the horizontal-swipe filter — do not start.
      notifyPressGesture('cancel')
      notifyCarouselGesture()
    }
  }

  window.addEventListener('pointerdown', onPointerDown, { capture: true })
  window.addEventListener('pointermove', onPointerMove, { capture: true })
  window.addEventListener('pointerup', onPointerUp, { capture: true })
  window.addEventListener('pointercancel', onPointerUp, { capture: true })

  window.addEventListener('keydown', (e) => {
    if (!menuVisible || title.hidden) return
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault()
      stepMode(-1)
    } else if (e.code === 'ArrowRight') {
      e.preventDefault()
      stepMode(1)
    }
  })

  return {
    setVisible(visible, opts) {
      window.clearTimeout(hideFadeTimer)
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
        const fadeMs = opts?.fadeMs ?? 0
        title.classList.remove('is-shown')
        if (fadeMs > 0) {
          // Keep in layout so opacity can ease out, then hard-hide.
          hideFadeTimer = window.setTimeout(() => {
            if (!title.classList.contains('is-shown')) {
              title.hidden = true
              title.classList.add('hidden')
            }
          }, fadeMs)
        } else {
          title.hidden = true
          title.classList.add('hidden')
        }
      }
    },
    setHighScore(score) {
      highScore.textContent = `Personal High Score: ${score}`
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
      for (const row of rows) {
        const li = document.createElement('li')
        li.textContent = `${row.name} — ${row.score}`
        boardList.appendChild(li)
      }
      boardStatus.textContent =
        statusText ?? (rows.length ? '' : 'No scores yet')
    },
    setMenuVisible(visible) {
      menuVisible = visible
      menu.hidden = !visible
      title.classList.toggle('is-menu-hidden', !visible)
    },
    setStatus(text) {
      status.textContent = text
      status.hidden = !text
    },
    setMatchStatus(state) {
      if (state === 'idle') {
        paintModeHoldPrompt()
        return
      }
      if (state === 'finding') {
        paintHoldPrompt('Finding opponent…', [])
        title.classList.add('is-matching')
        return
      }
      if (state === 'waiting') {
        paintHoldPrompt('Waiting for opponent…', [])
        title.classList.add('is-matching')
        return
      }
      paintHoldPrompt(state.error, ['Tap to try again'])
      title.classList.remove('is-matching')
    },
    setOnlineCount(n) {
      if (n == null || !Number.isFinite(n) || n < 0) {
        onlineCount.textContent = 'Players online: —'
        return
      }
      const count = Math.floor(n)
      onlineCount.textContent =
        count === 1 ? '1 player online' : `${count} players online`
    },
    setPlayMode(mode) {
      // Instant — used for sticky restore / death return, not user carousel.
      window.clearTimeout(finishTimer)
      clearModeAnimClasses()
      transitioning = false
      applyPlayMode(mode)
    },
    getPlayMode() {
      return playMode
    },
    onPlayModeChange(cb) {
      modeListeners.push(cb)
    },
    onCarouselGesture(cb) {
      gestureListeners.push(cb)
    },
    onTitlePressGesture(cb) {
      pressGestureListeners.push(cb)
    },
    setBattleHud(p0, p1, label) {
      battleHud.hidden = false
      battleP0.textContent = String(p0)
      battleP1.textContent = String(p1)
      battleLabel.textContent = label ?? 'Battle'
      localScoreP0.textContent = String(p0)
      localScoreP1.textContent = String(p1)
      for (const meta of document.querySelectorAll('.local-seat-meta')) {
        meta.textContent = label ?? 'Local'
      }
    },
    setResult(text) {
      if (!text) {
        result.hidden = true
        result.textContent = ''
        setLocalResults(null)
        return
      }
      result.hidden = false
      result.textContent = text
      setLocalResults(text)
    },
    setMatchBanner(titleText, count) {
      if (!titleText) {
        matchBanner.hidden = true
        matchBannerTitle.textContent = ''
        matchBannerCount.textContent = ''
        setLocalBanners(null)
        return
      }
      matchBanner.hidden = false
      matchBannerTitle.textContent = titleText
      matchBannerCount.textContent = count ?? ''
      matchBannerCount.hidden = !count
      setLocalBanners(titleText, count)
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
