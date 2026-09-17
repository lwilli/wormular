import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import './style.css'
import {
  ARENA_NARROW_SIDE_PX,
  ARENA_PADDING_NARROW_PX,
  ARENA_PADDING_PX,
  FIXED_DT,
  PRE_BATTLE_COUNTDOWN_MS,
  TITLE_DIM,
  TITLE_LAUNCH_MS,
  TITLE_RESTART_COOLDOWN_MS,
} from './core/config'
import { createBattleWorld, stepBattle } from './core/battle'
import { createWorld, step } from './core/world'
import type { BattleWorld, World } from './core/types'
import { createFpsMeter } from './debug/fps'
import {
  clearFx,
  createFx,
  deathProgress,
  handleGameEvent,
  isFreezing,
  updateFx,
  type FxState,
} from './fx/effects'
import { createDualHoldInput } from './input/dualHold'
import { createHoldInput } from './input/hold'
import { connectMatch, type MatchClient } from './net/matchClient'
import { createAudio } from './platform/audio'
import { trackPlay, trackVisit } from './platform/analytics'
import { fetchLeaderboard, submitScore } from './platform/leaderboard'
import {
  initNickname,
  loadNickname,
  saveNickname,
} from './platform/nickname'
import { initStorage, recordScore, loadHighScore } from './platform/storage'
import { drawBattleWorld, drawWorld } from './render/draw'
import { drawSpace } from './render/cosmic'
import { bindTitleUi, MODE_ORBIT_MS, neighborPlayMode, type PlayMode } from './ui/title'
import { Capacitor } from '@capacitor/core'

type Mode =
  | 'title'
  | 'playing'
  | 'dying'
  | 'battleLocal'
  | 'battleOnline'
  | 'matchmaking'
  | 'battleResult'

const PLAY_MODE_KEY = 'wormular.playMode'

function loadPlayMode(): PlayMode {
  try {
    const raw = localStorage.getItem(PLAY_MODE_KEY)
    if (raw === 'solo' || raw === 'local' || raw === 'online') return raw
  } catch {
    // ignore
  }
  return 'solo'
}

function savePlayMode(mode: PlayMode): void {
  try {
    localStorage.setItem(PLAY_MODE_KEY, mode)
  } catch {
    // ignore
  }
}

/** Survives Vite HMR so stale rAF loops can self-terminate. */
type BootState = { gen: number }
const boot: BootState = ((globalThis as unknown as { __wormularBoot?: BootState })
  .__wormularBoot ??= { gen: 0 })
boot.gen += 1
const myGen = boot.gen
let rafId = 0

trackVisit()

const canvasEl = document.querySelector('#game')
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('Missing #game canvas')
}
const canvas: HTMLCanvasElement = canvasEl
const ctxRaw = canvas.getContext('2d', { alpha: false })
if (!ctxRaw) throw new Error('2D context unavailable')
const ctx: CanvasRenderingContext2D = ctxRaw

const ui = bindTitleUi()
const audio = createAudio()
const soloInput = createHoldInput(canvas, { onPress: () => audio.unlock() })
const dualInput = createDualHoldInput(canvas, { onPress: () => audio.unlock() })
const fx = createFx()
const fps = createFpsMeter()

let mode: Mode = 'title'
let selectedPlayMode: PlayMode = loadPlayMode()
let highScore = loadHighScore()
let viewW = Math.max(1, window.innerWidth)
let viewH = Math.max(1, window.innerHeight)
let world = createPlayWorld()
let battle: BattleWorld | null = null
/** Cached paused arenas for idle side peeks (not the selected center mode). */
let peekSolo: World | null = null
let peekBattle: BattleWorld | null = null
let accum = 0
let lastTs = performance.now()
let awaitReleaseBeforeStart = false
/** True while a title canvas press might still become a mode swipe. */
let titlePressDeferred = false
let titleReadyAt = 0
let lastHudScore = -1
let matchClient: MatchClient | null = null
let onlineRole: 0 | 1 = 0
let onlineOpponentName = 'Opponent'
let onlinePlayerName = 'Player'
/** Keep online you=orange mirroring through the result flash. */
let onlineViewActive = false
/** Wall-clock ms when Local/Online pre-match countdown ends; null when idle. */
let preBattleCountdownUntil: number | null = null
let lastCountdownSec = -1
let onlineTick = 0
const onlineInputQueue = new Map<number, [boolean, boolean]>()
let resultClearAt = 0
/** How many lockstep ticks to pipeline ahead (masks Wi‑Fi / 30fps peer stalls). */
const ONLINE_INPUT_AHEAD = 3
/** Title mode carousel: keep the outgoing arena drawing while it slides away. */
let arenaSlide: {
  dir: 1 | -1
  t0: number
  dur: number
  outSolo: World | null
  outBattle: BattleWorld | null
} | null = null
/** Title → play: expand selected arena and fade chrome before gameplay. */
let titleLaunch: {
  t0: number
  dur: number
  fromScale: number
  kind: 'solo' | 'local' | 'online'
} | null = null

ui.setHighScore(highScore)
ui.setVisible(true)
ui.setHudVisible(false)
ui.setSfxEnabled(audio.isSfxEnabled())
ui.setMusicEnabled(audio.isMusicEnabled())
ui.setNickname(loadNickname() || 'Player')
ui.setMenuVisible(true)
ui.setPlayMode(selectedPlayMode)
ui.setStatus('')
ui.setResult(null)
ui.setMatchBanner(null)
document.getElementById('battle-hud')?.setAttribute('hidden', '')
ensureTitlePreview()

ui.onSfxToggle(() => {
  ui.setSfxEnabled(audio.toggleSfx())
})
ui.onMusicToggle(() => {
  ui.setMusicEnabled(audio.toggleMusic())
})

ui.onNicknameChange((raw) => {
  const saved = saveNickname(raw)
  if (saved) {
    ui.setNickname(saved)
    ui.setStatus('')
  } else if (raw.trim()) {
    const trimmed = raw.trim().replace(/\s+/g, ' ')
    if (trimmed.length < 3 || trimmed.length > 12) {
      ui.setStatus('Name must be 3-12 characters')
    } else if (!/^[a-zA-Z0-9 _.-]+$/.test(trimmed)) {
      ui.setStatus('Name can only use letters, numbers, spaces, and ._-')
    } else {
      ui.setStatus('Name not allowed — please choose a different name')
    }
  }
})

ui.onPlayModeChange((next, meta) => {
  const prevMode = selectedPlayMode
  if (
    meta.animate &&
    (mode === 'title' || mode === 'matchmaking')
  ) {
    arenaSlide = {
      dir: meta.dir,
      t0: performance.now(),
      dur: MODE_ORBIT_MS,
      outSolo: prevMode === 'solo' ? world : null,
      outBattle: prevMode !== 'solo' ? battle : null,
    }
    // Detach so ensureTitlePreview cannot reuse the outgoing battle.
    if (prevMode !== 'solo') battle = null
  } else {
    arenaSlide = null
  }

  selectedPlayMode = next
  savePlayMode(next)
  // Switching modes cancels an in-progress queue.
  if (mode === 'matchmaking') {
    stopMatchClient()
    mode = 'title'
    ui.setStatus('')
    ui.setMatchStatus('idle')
  }
  if (mode === 'title') {
    // Mode tabs must not inherit a leftover hold/playRequested from queueing
    // or a prior Press & Hold — re-arm the start gate.
    armTitleStartGate()
    ensureTitlePreview(true)
  }
})

/** Defer title start until tap / hold is distinguished from a mode swipe. */
ui.onTitlePressGesture((phase) => {
  titlePressDeferred = phase === 'defer'
})

/** Swipe between modes: cancel the press that would have started a run. */
ui.onCarouselGesture(() => {
  titlePressDeferred = false
  soloInput.playRequested = false
  dualInput.playRequested = false
  awaitReleaseBeforeStart = true
})

void initStorage().then(() => {
  highScore = loadHighScore()
  ui.setHighScore(highScore)
})

void initNickname().then(() => {
  const n = loadNickname()
  if (n) ui.setNickname(n)
})

void refreshLeaderboard()

function arenaRadius(): number {
  const side = Math.min(viewW, viewH)
  const pad =
    side < ARENA_NARROW_SIDE_PX ? ARENA_PADDING_NARROW_PX : ARENA_PADDING_PX
  return Math.max(80, side * 0.5 - pad)
}

function createPlayWorld(): World {
  return createWorld(arenaRadius(), Date.now())
}

function createTitleBattle(): BattleWorld {
  return createBattleWorld(arenaRadius(), Date.now())
}

/** Paused arena behind the title: solo worm or both 1v1 worms. */
function ensureTitlePreview(force = false): void {
  const R = arenaRadius()
  if (selectedPlayMode === 'solo') {
    battle = null
    if (force || Math.abs(world.R - R) > 2) world = createPlayWorld()
  } else {
    // Fresh paused battle layout whenever mode needs one (or size changed).
    if (
      force ||
      !battle ||
      Math.abs(battle.R - R) > 2 ||
      battle.tick > 0 ||
      battle.winner !== null
    ) {
      battle = createTitleBattle()
    }
  }
  ensurePeekPreviews(force)
}

/** Side-peek mini arenas so neighbors look like real selectable modes. */
function ensurePeekPreviews(force = false): void {
  const R = arenaRadius()
  if (force || !peekSolo || Math.abs(peekSolo.R - R) > 2) {
    peekSolo = createPlayWorld()
  }
  if (force || !peekBattle || Math.abs(peekBattle.R - R) > 2) {
    peekBattle = createTitleBattle()
  }
}

function previewWorldFor(mode: PlayMode): World | BattleWorld {
  if (mode === 'solo') {
    return selectedPlayMode === 'solo' ? world : peekSolo!
  }
  if (selectedPlayMode === mode && battle) return battle
  return peekBattle!
}

function drawTitleModePreview(
  playMode: PlayMode,
  opts: { offsetX: number; scale: number; time: number },
): void {
  const drawOpts = {
    dim: 0,
    time: opts.time,
    skipSpace: true,
    skipDim: true,
    clipArena: true,
    offsetX: opts.offsetX,
    scale: opts.scale,
  } as const
  if (playMode === 'solo') {
    drawWorld(ctx, previewWorldFor(playMode) as World, viewW, viewH, fx, drawOpts)
  } else {
    drawBattleWorld(
      ctx,
      previewWorldFor(playMode) as BattleWorld,
      viewW,
      viewH,
      fx,
      drawOpts,
    )
  }
}

/** Opaque disk under a side peek so it reads as its own mode, not part of center. */
function drawPeekPlate(offsetX: number, diameter: number): void {
  const cx = viewW * 0.5 + offsetX
  const cy = viewH * 0.5
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, diameter * 0.5 + 1, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(7, 9, 20, 0.97)'
  ctx.fill()
  ctx.restore()
}

type OrbitLayout = {
  peekD: number
  peekScale: number
  shift: number
  /** Selected mode scale on title — shrunk so peeks sit beside it with a gap. */
  centerScale: number
}

function orbitLayout(): OrbitLayout {
  const arenaD = arenaRadius() * 2
  const arenaR = arenaD * 0.5
  const rootPx =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const narrow = Math.min(viewW, viewH) < ARENA_NARROW_SIDE_PX
  const peekD = narrow
    ? Math.min(viewW * 0.22, 5.75 * rootPx)
    : Math.min(viewW * 0.24, 7 * rootPx)
  const gap = Math.max(12, Math.min(24, viewW * 0.036))
  const labelPad = Math.max(2.4 * rootPx, peekD * 0.42)
  const maxShift = viewW * 0.5 - labelPad
  // Fit: centerScale*arenaR + peekR + gap <= maxShift (peeks outside the selected rim).
  const centerScale = Math.min(
    1,
    Math.max(0.55, (maxShift - peekD * 0.5 - gap) / arenaR),
  )
  const shift = Math.min(maxShift, centerScale * arenaR + peekD * 0.5 + gap)
  return {
    peekD,
    peekScale: peekD / arenaD,
    shift,
    centerScale,
  }
}

/** Keep HTML peek hit-targets aligned with the canvas layout. */
function syncOrbitCss(layout: OrbitLayout): void {
  const carousel = document.getElementById('mode-carousel')
  if (!carousel) return
  carousel.style.setProperty('--peek-d', `${layout.peekD}px`)
  carousel.style.setProperty('--orbit-shift', `${layout.shift}px`)
  carousel.style.setProperty('--title-center-scale', String(layout.centerScale))
}

function easeOrbit(u: number): number {
  // Match `--orbit-ease: cubic-bezier(0.22, 1, 0.36, 1)` roughly.
  const t = Math.min(1, Math.max(0, u))
  return 1 - (1 - t) ** 3
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

function platformTag(): string {
  return Capacitor.isNativePlatform() ? 'ios' : 'web'
}

async function refreshLeaderboard(): Promise<void> {
  ui.setLeaderboard([], 'Loading…')
  try {
    const rows = await fetchLeaderboard()
    ui.setLeaderboard(
      rows.map((r) => ({ name: r.name, score: r.score })),
      rows.length ? '' : 'No scores yet',
    )
  } catch {
    ui.setLeaderboard([], 'Leaderboard offline')
  }
}

async function submitRunScore(score: number): Promise<void> {
  if (score <= 0) return
  const name = saveNickname(ui.getNickname()) ?? loadNickname() ?? 'Player'
  try {
    await submitScore(name, score, platformTag())
    await refreshLeaderboard()
  } catch (err) {
    // Soft-fail — local high score still saved; tell the player why.
    const message =
      err instanceof Error && /rate limited/i.test(err.message)
        ? 'Score not saved — too soon, try again'
        : 'Score not saved — leaderboard offline'
    ui.setStatus(message)
    void refreshLeaderboard()
  }
}

function stopMatchClient(): void {
  matchClient?.close()
  matchClient = null
  onlineInputQueue.clear()
  onlineTick = 0
}

/** Require a fresh release + press before title can start a run. */
function armTitleStartGate(): void {
  soloInput.playRequested = false
  dualInput.playRequested = false
  awaitReleaseBeforeStart = true
  titlePressDeferred = false
  titleReadyAt = performance.now() + TITLE_RESTART_COOLDOWN_MS
}

function showTitle(): void {
  arenaSlide = null
  titleLaunch = null
  mode = 'title'
  onlineViewActive = false
  stopMatchClient()
  world = createPlayWorld()
  battle = null
  ensureTitlePreview()
  clearFx(fx)
  soloInput.holding = false
  dualInput.holding[0] = false
  dualInput.holding[1] = false
  armTitleStartGate()
  ui.setVisible(true)
  ui.setMenuVisible(true)
  ui.setPlayMode(selectedPlayMode)
  ui.setHudVisible(false)
  ui.setStatus('')
  ui.setMatchStatus('idle')
  ui.setResult(null)
  ui.setMatchBanner(null)
  preBattleCountdownUntil = null
  lastCountdownSec = -1
  document.getElementById('battle-hud')?.setAttribute('hidden', '')
}

/** Start only on a fresh intentional press after death cooldown + release. */
function requestStart(): void {
  if (mode !== 'title') return
  if (titleLaunch) return
  if (awaitReleaseBeforeStart) return
  if (performance.now() < titleReadyAt) return
  audio.unlock()
  if (selectedPlayMode === 'solo') startSolo()
  else if (selectedPlayMode === 'local') startBattleLocal()
  else startMatchmaking()
}

function beginTitleLaunch(kind: 'solo' | 'local' | 'online'): void {
  arenaSlide = null
  const { centerScale } = orbitLayout()
  const fromScale = reduceMotionLaunch() ? 1 : centerScale
  titleLaunch = {
    t0: performance.now(),
    dur: reduceMotionLaunch() ? 0 : TITLE_LAUNCH_MS,
    fromScale,
    kind,
  }
  // Fade title chrome while the arena expands into play.
  ui.setMenuVisible(false)
  ui.setVisible(false, { fadeMs: Math.max(TITLE_LAUNCH_MS, 180) })
  if (titleLaunch.dur <= 0) {
    finishTitleLaunch()
  }
}

function reduceMotionLaunch(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function finishTitleLaunch(): void {
  if (!titleLaunch) return
  const kind = titleLaunch.kind
  titleLaunch = null
  if (kind === 'solo') finishStartSolo()
  else if (kind === 'local') finishStartLocal()
  else finishStartOnline()
}

function startSolo(): void {
  trackPlay('solo')
  battle = null
  clearFx(fx)
  awaitReleaseBeforeStart = false
  soloInput.playRequested = false
  lastHudScore = -1
  beginTitleLaunch('solo')
}

function finishStartSolo(): void {
  mode = 'playing'
  ui.setVisible(false)
  ui.setMenuVisible(false)
  ui.setHudVisible(true)
  ui.setScore(0)
  ui.setStatus('')
}

function startBattleLocal(): void {
  trackPlay('local')
  onlineViewActive = false
  // Reuse the paused title battle so layout does not pop on start.
  if (!battle || battle.tick > 0 || battle.winner !== null) {
    battle = createTitleBattle()
  }
  clearFx(fx)
  // Tap-to-start: clear the tap so nobody thrusts during the countdown.
  soloInput.holding = false
  soloInput.playRequested = false
  dualInput.holding[0] = false
  dualInput.holding[1] = false
  dualInput.playRequested = false
  beginTitleLaunch('local')
}

function finishStartLocal(): void {
  mode = 'battleLocal'
  preBattleCountdownUntil = performance.now() + PRE_BATTLE_COUNTDOWN_MS
  lastCountdownSec = -1
  ui.setVisible(false)
  ui.setMenuVisible(false)
  ui.setHudVisible(false)
  ui.setBattleHud(0, 0, 'Local')
  document.getElementById('battle-hud')?.removeAttribute('hidden')
  ui.setMatchBanner('Get ready', '5')
}

function startMatchmaking(): void {
  stopMatchClient()
  mode = 'matchmaking'
  // Don't let the queue-hold act as a start if the player cancels back to title.
  soloInput.playRequested = false
  dualInput.playRequested = false
  ensureTitlePreview()
  ui.setMatchStatus('finding')
  ui.setMenuVisible(true)
  const name = saveNickname(ui.getNickname()) ?? 'Player'
  onlinePlayerName = name
  matchClient = connectMatch(name, {
    onQueued: () => {
      trackPlay('online_queue')
      ui.setMatchStatus('waiting')
    },
    onStart: ({ seed, you, opponentName }) => {
      trackPlay('online')
      onlineRole = you
      onlineOpponentName = opponentName
      onlineViewActive = true
      onlineTick = 0
      onlineInputQueue.clear()
      battle = createBattleWorld(arenaRadius(), seed)
      clearFx(fx)
      dualInput.holding[1] = false
      dualInput.playRequested = false
      ui.setMatchStatus('idle')
      ui.setBattleHud(0, 0, `vs ${opponentName}`)
      beginTitleLaunch('online')
    },
    onInputs: (tick, holding) => {
      onlineInputQueue.set(tick, holding)
    },
    onForfeit: (winner) => {
      // Ignore disconnect noise after a normal death already ended the match.
      if (mode === 'battleResult') return
      endBattle(winner === onlineRole ? 'You win (forfeit)' : 'You lose (disconnect)')
    },
    onError: (message) => {
      ui.setMatchStatus({ error: message })
      mode = 'title'
      stopMatchClient()
      armTitleStartGate()
      ensureTitlePreview()
    },
    onClose: () => {
      if (mode === 'matchmaking') {
        ui.setMatchStatus({ error: 'Connection closed' })
        mode = 'title'
        armTitleStartGate()
        ensureTitlePreview()
      }
    },
  })
}

function finishStartOnline(): void {
  mode = 'battleOnline'
  preBattleCountdownUntil = performance.now() + PRE_BATTLE_COUNTDOWN_MS
  lastCountdownSec = -1
  ui.setVisible(false)
  ui.setMenuVisible(false)
  ui.setHudVisible(false)
  document.getElementById('battle-hud')?.removeAttribute('hidden')
  ui.setMatchBanner(`${onlinePlayerName} vs ${onlineOpponentName}`, '5')
}

function endBattle(message: string): void {
  if (mode === 'battleResult') return
  mode = 'battleResult'
  preBattleCountdownUntil = null
  ui.setMatchBanner(null)
  ui.setResult(message)
  resultClearAt = performance.now() + 2200
  // Tell the room the match is over before closing, otherwise the peer gets a
  // bogus "win (forfeit)" when this socket drops.
  matchClient?.finish()
  stopMatchClient()
}

function returnToTitleFromSolo(): void {
  const score = world.score
  highScore = recordScore(score)
  ui.setHighScore(highScore)
  void submitRunScore(score)
  showTitle()
}

function resize(): void {
  const vv = window.visualViewport
  viewW = Math.max(1, Math.round(vv?.width ?? window.innerWidth))
  viewH = Math.max(1, Math.round(vv?.height ?? window.innerHeight))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const maxMajor = 900
  const major = Math.max(viewW, viewH) * dpr
  const scale = major > maxMajor ? maxMajor / major : 1
  const bufScale = dpr * scale
  const bw = Math.max(1, Math.floor(viewW * bufScale))
  const bh = Math.max(1, Math.floor(viewH * bufScale))

  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw
    canvas.height = bh
  }
  canvas.style.width = `${viewW}px`
  canvas.style.height = `${viewH}px`
  ctx.setTransform(bufScale, 0, 0, bufScale, 0, 0)

  const R = arenaRadius()
  if (mode === 'title' || mode === 'matchmaking') {
    ensureTitlePreview()
    syncOrbitCss(orbitLayout())
  } else if (mode === 'playing' || mode === 'dying') {
    if (Math.abs(world.R - R) > 2) world = createPlayWorld()
  } else if (
    (mode === 'battleLocal' || mode === 'battleOnline') &&
    battle &&
    Math.abs(battle.R - R) > 2
  ) {
    // Keep playing; rare mid-match resize — rebuild is worse than a slight mismatch.
  }
}

window.addEventListener('resize', resize)
window.visualViewport?.addEventListener('resize', resize)
window.visualViewport?.addEventListener('scroll', resize)
resize()

function handleBattleEvents(b: BattleWorld): void {
  for (const ev of b.events) {
    if (ev.type === 'AteFood') {
      handleGameEvent(fx, {
        type: 'AteFood',
        x: ev.x,
        y: ev.y,
        color: ev.color,
        radius: ev.radius,
      })
      audio.playEat()
    } else if (ev.type === 'Died') {
      handleGameEvent(fx, {
        type: 'Died',
        x: ev.x,
        y: ev.y,
        cause: ev.cause,
      })
      if (ev.cause === 'center') audio.playWoosh()
      else audio.playCrash()
    }
  }
  if (b.winner !== null && mode !== 'battleResult') {
    const youWin =
      mode === 'battleOnline' ? b.winner === onlineRole : b.winner === 0
    const label =
      mode === 'battleOnline'
        ? youWin
          ? 'You win!'
          : 'You lose'
        : b.winner === 0
          ? 'Orange wins!'
          : 'Teal wins!'
    endBattle(label)
  }
}

function frame(ts: number): void {
  if (myGen !== boot.gen) return

  const rawDt = Math.min(0.05, (ts - lastTs) / 1000)
  lastTs = ts
  accum += rawDt
  // Avoid banking a huge catch-up debt while lockstep waits on the peer.
  if (mode === 'battleOnline') {
    accum = Math.min(accum, FIXED_DT * 5)
  }

  if (mode === 'title') {
    if (titleLaunch) {
      // Launch owns the press — don't re-fire start.
      soloInput.playRequested = false
      dualInput.playRequested = false
    } else if (awaitReleaseBeforeStart) {
      // Swallow held taps from the death mash; arm only after release.
      soloInput.playRequested = false
      dualInput.playRequested = false
      if (ts >= titleReadyAt && !soloInput.holding) {
        awaitReleaseBeforeStart = false
      }
    } else if (
      !titlePressDeferred &&
      (soloInput.playRequested ||
        soloInput.holding ||
        (selectedPlayMode === 'local' && dualInput.playRequested))
    ) {
      requestStart()
    }
  }

  if (mode === 'battleResult' && ts >= resultClearAt) {
    showTitle()
    void refreshLeaderboard()
  }

  // Pre-match countdown (Local tap-to-start / Online matched → 5..1 → Go).
  if (
    (mode === 'battleLocal' || mode === 'battleOnline') &&
    preBattleCountdownUntil !== null
  ) {
    const left = preBattleCountdownUntil - ts
    const bannerTitle =
      mode === 'battleOnline'
        ? `${onlinePlayerName} vs ${onlineOpponentName}`
        : 'Get ready'
    if (left <= 0) {
      preBattleCountdownUntil = null
      ui.setMatchBanner(null)
      lastCountdownSec = -1
      // Seed a few ticks so online lockstep does not stall on the first frames.
      if (mode === 'battleOnline' && matchClient) {
        const holding = soloInput.holding
        for (let t = 0; t <= ONLINE_INPUT_AHEAD; t++) {
          matchClient.sendInput(t, holding)
        }
      }
    } else if (left <= 450) {
      if (lastCountdownSec !== 0) {
        lastCountdownSec = 0
        ui.setMatchBanner(bannerTitle, 'Go!')
      }
    } else {
      const sec = Math.max(1, Math.ceil(left / 1000))
      if (sec !== lastCountdownSec) {
        lastCountdownSec = sec
        ui.setMatchBanner(bannerTitle, String(sec))
      }
    }
  }

  const t0 = performance.now()
  while (accum >= FIXED_DT) {
    // Online lockstep: pipeline inputs ahead; only wait when the queue is dry.
    if (mode === 'battleOnline' && battle && matchClient) {
      if (preBattleCountdownUntil !== null || isFreezing(fx)) {
        accum = Math.min(accum, FIXED_DT)
        break
      }
      const holding = soloInput.holding
      for (let t = onlineTick; t <= onlineTick + ONLINE_INPUT_AHEAD; t++) {
        matchClient.sendInput(t, holding)
      }
      const pair = onlineInputQueue.get(onlineTick)
      if (!pair) {
        // Don't burn sim time, but keep accum from exploding while we wait.
        accum = Math.min(accum, FIXED_DT)
        break
      }
      accum -= FIXED_DT
      onlineInputQueue.delete(onlineTick)
      stepBattle(battle, { holding: pair }, FIXED_DT)
      handleBattleEvents(battle)
      ui.setBattleHud(
        battle.players[onlineRole].score,
        battle.players[1 - onlineRole].score,
        `vs ${onlineOpponentName}`,
      )
      onlineTick += 1
      continue
    }

    accum -= FIXED_DT

    if (mode === 'playing' && !isFreezing(fx)) {
      step(world, { holding: soloInput.holding }, FIXED_DT)
      for (const ev of world.events) {
        handleGameEvent(fx, ev)
        if (ev.type === 'AteFood') audio.playEat()
        else if (ev.type === 'Died') {
          if (ev.cause === 'center') audio.playWoosh()
          else audio.playCrash()
          mode = 'dying'
        }
      }
      if (world.score !== lastHudScore) {
        lastHudScore = world.score
        ui.setScore(world.score)
      }
    }

    if (mode === 'battleLocal' && battle && !isFreezing(fx)) {
      if (preBattleCountdownUntil !== null) {
        accum = Math.min(accum, FIXED_DT)
        break
      }
      stepBattle(
        battle,
        { holding: [dualInput.holding[0], dualInput.holding[1]] },
        FIXED_DT,
      )
      handleBattleEvents(battle)
      ui.setBattleHud(
        battle.players[0].score,
        battle.players[1].score,
        'Local',
      )
    }
  }

  if (updateFx(fx, rawDt) && mode === 'dying') {
    returnToTitleFromSolo()
  }
  const t1 = performance.now()

  if (arenaSlide && (mode === 'title' || mode === 'matchmaking')) {
    const u = easeOrbit((ts - arenaSlide.t0) / arenaSlide.dur)
    if (u >= 1) {
      // Keep the outgoing world as the peek that just slid away — no content pop.
      if (arenaSlide.outSolo) peekSolo = arenaSlide.outSolo
      if (arenaSlide.outBattle) peekBattle = arenaSlide.outBattle
      arenaSlide = null
    } else {
      const { peekScale, shift, centerScale } = orbitLayout()
      const dir = arenaSlide.dir
      const outX = lerp(0, -dir * shift, u)
      const outS = lerp(centerScale, peekScale, u)
      const inX = lerp(dir * shift, 0, u)
      const inS = lerp(peekScale, centerScale, u)
      const time = ts * 0.001
      const slideOpts = {
        dim: 0,
        time,
        skipSpace: true,
        skipDim: true,
        clipArena: true,
      } as const

      drawSpace(ctx, viewW, viewH)

      if (arenaSlide.outBattle) {
        drawBattleWorld(ctx, arenaSlide.outBattle, viewW, viewH, fx, {
          ...slideOpts,
          offsetX: outX,
          scale: outS,
        })
      } else if (arenaSlide.outSolo) {
        drawWorld(ctx, arenaSlide.outSolo, viewW, viewH, fx, {
          ...slideOpts,
          offsetX: outX,
          scale: outS,
        })
      }

      if (selectedPlayMode !== 'solo' && battle) {
        drawBattleWorld(ctx, battle, viewW, viewH, fx, {
          ...slideOpts,
          offsetX: inX,
          scale: inS,
        })
      } else {
        drawWorld(ctx, world, viewW, viewH, fx, {
          ...slideOpts,
          offsetX: inX,
          scale: inS,
        })
      }

      ctx.fillStyle = `rgba(5, 6, 14, ${TITLE_DIM})`
      ctx.fillRect(0, 0, viewW, viewH)
    }
  }

  if (titleLaunch) {
    const u =
      titleLaunch.dur <= 0
        ? 1
        : easeOrbit((ts - titleLaunch.t0) / titleLaunch.dur)
    const layout = orbitLayout()
    const scale = lerp(titleLaunch.fromScale, 1, Math.min(1, u))
    const peekFade = 1 - Math.min(1, u)
    const time = ts * 0.001
    const prev = neighborPlayMode(selectedPlayMode, -1)
    const next = neighborPlayMode(selectedPlayMode, 1)
    drawSpace(ctx, viewW, viewH)
    if (peekFade > 0.02) {
      ctx.save()
      ctx.globalAlpha = peekFade
      drawPeekPlate(-layout.shift, layout.peekD)
      drawTitleModePreview(prev, {
        offsetX: -layout.shift,
        scale: layout.peekScale,
        time,
      })
      drawPeekPlate(layout.shift, layout.peekD)
      drawTitleModePreview(next, {
        offsetX: layout.shift,
        scale: layout.peekScale,
        time,
      })
      ctx.restore()
    }
    // Expanding selected arena (solo world, local battle, or matched online).
    if (titleLaunch.kind === 'solo' || selectedPlayMode === 'solo') {
      drawTitleModePreview('solo', { offsetX: 0, scale, time })
    } else if (battle) {
      drawBattleWorld(ctx, battle, viewW, viewH, fx, {
        dim: 0,
        time,
        skipSpace: true,
        skipDim: true,
        clipArena: true,
        offsetX: 0,
        scale,
        viewAs: titleLaunch.kind === 'online' ? onlineRole : undefined,
      })
    }
    const dim = TITLE_DIM * (1 - Math.min(1, u))
    if (dim > 0.01) {
      ctx.fillStyle = `rgba(5, 6, 14, ${dim})`
      ctx.fillRect(0, 0, viewW, viewH)
    }
    if (u >= 1) finishTitleLaunch()
  } else if (!arenaSlide) {
    const onTitle = mode === 'title' || mode === 'matchmaking'
    if (onTitle) {
      ensurePeekPreviews()
      const layout = orbitLayout()
      syncOrbitCss(layout)
      const { peekScale, shift, centerScale, peekD } = layout
      const time = ts * 0.001
      const prev = neighborPlayMode(selectedPlayMode, -1)
      const next = neighborPlayMode(selectedPlayMode, 1)
      drawSpace(ctx, viewW, viewH)
      drawTitleModePreview(selectedPlayMode, {
        offsetX: 0,
        scale: centerScale,
        time,
      })
      ctx.fillStyle = `rgba(5, 6, 14, ${TITLE_DIM})`
      ctx.fillRect(0, 0, viewW, viewH)
      // Separate mode disks: opaque plate + mini arena, beside the selected mode.
      drawPeekPlate(-shift, peekD)
      drawTitleModePreview(prev, {
        offsetX: -shift,
        scale: peekScale,
        time,
      })
      drawPeekPlate(shift, peekD)
      drawTitleModePreview(next, {
        offsetX: shift,
        scale: peekScale,
        time,
      })
    } else if (
      battle &&
      (mode === 'battleLocal' ||
        mode === 'battleOnline' ||
        mode === 'battleResult')
    ) {
      drawBattleWorld(ctx, battle, viewW, viewH, fx, {
        dim:
          mode === 'battleResult'
            ? 0.2
            : preBattleCountdownUntil !== null
              ? 0.18
              : 0,
        time: ts * 0.001,
        viewAs: onlineViewActive ? onlineRole : undefined,
      })
    } else {
      drawWorld(ctx, world, viewW, viewH, fx, {
        dim: titleDimForMode(mode, fx),
        time: ts * 0.001,
      })
    }
  }
  const t2 = performance.now()

  fps.frame(ts, {
    simMs: t1 - t0,
    drawMs: t2 - t1,
    extra: `${world.worm.points.length}p ${canvas.width}x${canvas.height}`,
  })
  rafId = requestAnimationFrame(frame)
}

/** Ease the arena into title dim during death, then hold that dim on title. */
function titleDimForMode(m: Mode, fxState: FxState): number {
  if (m === 'title' || m === 'matchmaking') return TITLE_DIM
  if (m === 'dying') {
    const u = deathProgress(fxState)
    // Hold death readable, then ramp dim in the back half before title.
    const fade = u < 0.45 ? 0 : (u - 0.45) / 0.55
    const eased = fade * fade
    return TITLE_DIM * Math.min(1, eased)
  }
  return 0
}

rafId = requestAnimationFrame(frame)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    window.visualViewport?.removeEventListener('resize', resize)
    window.visualViewport?.removeEventListener('scroll', resize)
    soloInput.destroy()
    dualInput.destroy()
    stopMatchClient()
    fps.dispose()
  })
}
