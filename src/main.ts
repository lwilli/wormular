import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import './style.css'
import {
  ARENA_NARROW_SIDE_PX,
  ARENA_PADDING_NARROW_PX,
  ARENA_PADDING_PX,
  FIXED_DT,
  TITLE_RESTART_COOLDOWN_MS,
} from './core/config'
import { createBattleWorld, stepBattle } from './core/battle'
import { createWorld, step } from './core/world'
import type { BattleWorld, World } from './core/types'
import { createFpsMeter } from './debug/fps'
import {
  clearFx,
  createFx,
  handleGameEvent,
  isFreezing,
  updateFx,
} from './fx/effects'
import { createDualHoldInput } from './input/dualHold'
import { createHoldInput } from './input/hold'
import { connectMatch, type MatchClient } from './net/matchClient'
import { createAudio } from './platform/audio'
import { fetchLeaderboard, submitScore } from './platform/leaderboard'
import {
  initNickname,
  loadNickname,
  saveNickname,
} from './platform/nickname'
import { initStorage, recordScore, loadHighScore } from './platform/storage'
import { drawBattleWorld, drawWorld } from './render/draw'
import { bindTitleUi, type PlayMode } from './ui/title'
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
let accum = 0
let lastTs = performance.now()
let awaitReleaseBeforeStart = false
let titleReadyAt = 0
let lastHudScore = -1
let matchClient: MatchClient | null = null
let onlineRole: 0 | 1 = 0
let onlineOpponentName = 'Opponent'
/** Keep online you=orange mirroring through the result flash. */
let onlineViewActive = false
let onlineTick = 0
let pendingOnlineHolding: boolean | null = null
const onlineInputQueue = new Map<number, [boolean, boolean]>()
let resultClearAt = 0
/** After Press & Hold starts a battle, freeze until release so both worms stay equal. */
let battleFrozenUntilRelease = false

ui.setHighScore(highScore)
ui.setVisible(true)
ui.setHudVisible(false)
ui.setSoundEnabled(audio.isEnabled())
ui.setNickname(loadNickname() || 'Player')
ui.setMenuVisible(true)
ui.setPlayMode(selectedPlayMode)
ui.setStatus('')
ui.setResult(null)
document.getElementById('battle-hud')?.setAttribute('hidden', '')
ensureTitlePreview()

ui.onSoundToggle(() => {
  const enabled = audio.toggle()
  ui.setSoundEnabled(enabled)
})

ui.onNicknameChange((raw) => {
  const saved = saveNickname(raw)
  if (saved) ui.setNickname(saved)
})

ui.onPlayModeChange((next) => {
  selectedPlayMode = next
  savePlayMode(next)
  // Switching modes cancels an in-progress queue.
  if (mode === 'matchmaking') {
    stopMatchClient()
    mode = 'title'
    ui.setStatus('')
  }
  if (mode === 'title') {
    // Mode tabs must not inherit a leftover hold/playRequested from queueing
    // or a prior Press & Hold — re-arm the start gate.
    armTitleStartGate()
    ensureTitlePreview()
  }
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
function ensureTitlePreview(): void {
  const R = arenaRadius()
  if (selectedPlayMode === 'solo') {
    battle = null
    if (Math.abs(world.R - R) > 2) world = createPlayWorld()
    return
  }
  // Fresh paused battle layout whenever mode needs one (or size changed).
  if (!battle || Math.abs(battle.R - R) > 2 || battle.tick > 0 || battle.winner !== null) {
    battle = createTitleBattle()
  }
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
  pendingOnlineHolding = null
  onlineTick = 0
}

/** Require a fresh release + press before title can start a run. */
function armTitleStartGate(): void {
  soloInput.playRequested = false
  dualInput.playRequested = false
  awaitReleaseBeforeStart = true
  titleReadyAt = performance.now() + TITLE_RESTART_COOLDOWN_MS
}

function showTitle(): void {
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
  ui.setResult(null)
  document.getElementById('battle-hud')?.setAttribute('hidden', '')
}

/** Start only on a fresh intentional press after death cooldown + release. */
function requestStart(): void {
  if (mode !== 'title') return
  if (awaitReleaseBeforeStart) return
  if (performance.now() < titleReadyAt) return
  audio.unlock()
  if (selectedPlayMode === 'solo') startSolo()
  else if (selectedPlayMode === 'local') startBattleLocal()
  else startMatchmaking()
}

function startSolo(): void {
  mode = 'playing'
  battle = null
  clearFx(fx)
  awaitReleaseBeforeStart = false
  soloInput.playRequested = false
  lastHudScore = -1
  ui.setVisible(false)
  ui.setMenuVisible(false)
  ui.setHudVisible(true)
  ui.setScore(0)
  ui.setStatus('')
}

function startBattleLocal(): void {
  mode = 'battleLocal'
  onlineViewActive = false
  // Reuse the paused title battle so layout does not pop on start.
  if (!battle || battle.tick > 0 || battle.winner !== null) {
    battle = createTitleBattle()
  }
  clearFx(fx)
  // Freeze until the start-hold releases so orange does not thrust alone
  // while teal falls in (keeps both at the same radius).
  battleFrozenUntilRelease = true
  dualInput.holding[1] = false
  dualInput.playRequested = false
  ui.setVisible(false)
  ui.setMenuVisible(false)
  ui.setHudVisible(false)
  ui.setBattleHud(0, 0, 'Local')
  document.getElementById('battle-hud')?.removeAttribute('hidden')
}

function startMatchmaking(): void {
  stopMatchClient()
  mode = 'matchmaking'
  // Don't let the queue-hold act as a start if the player cancels back to title.
  soloInput.playRequested = false
  dualInput.playRequested = false
  ensureTitlePreview()
  ui.setStatus('Finding opponent…')
  ui.setMenuVisible(true)
  const name = saveNickname(ui.getNickname()) ?? 'Player'
  matchClient = connectMatch(name, {
    onQueued: () => ui.setStatus('Waiting for opponent…'),
    onStart: ({ seed, you, opponentName }) => {
      onlineRole = you
      onlineOpponentName = opponentName
      onlineViewActive = true
      onlineTick = 0
      onlineInputQueue.clear()
      battle = createBattleWorld(arenaRadius(), seed)
      mode = 'battleOnline'
      clearFx(fx)
      battleFrozenUntilRelease = true
      dualInput.holding[1] = false
      dualInput.playRequested = false
      ui.setVisible(false)
      ui.setMenuVisible(false)
      ui.setHudVisible(false)
      ui.setStatus('')
      // You = orange (left score); opponent = teal (right).
      ui.setBattleHud(0, 0, `vs ${opponentName}`)
      document.getElementById('battle-hud')?.removeAttribute('hidden')
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
      ui.setStatus(message)
      mode = 'title'
      stopMatchClient()
      armTitleStartGate()
      ensureTitlePreview()
    },
    onClose: () => {
      if (mode === 'matchmaking') {
        ui.setStatus('Connection closed')
        mode = 'title'
        armTitleStartGate()
        ensureTitlePreview()
      }
    },
  })
}

function endBattle(message: string): void {
  if (mode === 'battleResult') return
  mode = 'battleResult'
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

  if (mode === 'title') {
    if (awaitReleaseBeforeStart) {
      // Swallow held taps from the death mash; arm only after release.
      soloInput.playRequested = false
      dualInput.playRequested = false
      if (ts >= titleReadyAt && !soloInput.holding) {
        awaitReleaseBeforeStart = false
      }
    } else if (
      soloInput.playRequested ||
      soloInput.holding ||
      (selectedPlayMode === 'local' && dualInput.playRequested)
    ) {
      requestStart()
    }
  }

  if (mode === 'battleResult' && ts >= resultClearAt) {
    showTitle()
    void refreshLeaderboard()
  }

  const t0 = performance.now()
  while (accum >= FIXED_DT) {
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
      if (battleFrozenUntilRelease) {
        if (!dualInput.holding[0] && !soloInput.holding) {
          battleFrozenUntilRelease = false
        }
      } else {
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

    if (mode === 'battleOnline' && battle && matchClient && !isFreezing(fx)) {
      if (battleFrozenUntilRelease) {
        if (!soloInput.holding && !dualInput.holding[0]) {
          battleFrozenUntilRelease = false
        }
      } else {
        const holding = soloInput.holding
        if (pendingOnlineHolding === null || pendingOnlineHolding !== holding) {
          matchClient.sendInput(onlineTick, holding)
          pendingOnlineHolding = holding
        } else {
          matchClient.sendInput(onlineTick, holding)
        }
        const pair = onlineInputQueue.get(onlineTick)
        if (pair) {
          onlineInputQueue.delete(onlineTick)
          stepBattle(battle, { holding: pair }, FIXED_DT)
          handleBattleEvents(battle)
          ui.setBattleHud(
            battle.players[onlineRole].score,
            battle.players[1 - onlineRole].score,
            `vs ${onlineOpponentName}`,
          )
          onlineTick += 1
          pendingOnlineHolding = null
        }
      }
    }
  }

  if (updateFx(fx, rawDt) && mode === 'dying') {
    returnToTitleFromSolo()
  }
  const t1 = performance.now()

  if (
    battle &&
    (mode === 'battleLocal' ||
      mode === 'battleOnline' ||
      mode === 'battleResult' ||
      ((mode === 'title' || mode === 'matchmaking') &&
        selectedPlayMode !== 'solo'))
  ) {
    drawBattleWorld(ctx, battle, viewW, viewH, fx, {
      dim:
        mode === 'battleResult'
          ? 0.2
          : mode === 'title' || mode === 'matchmaking'
            ? 0.14
            : 0,
      time: ts * 0.001,
      viewAs: onlineViewActive ? onlineRole : undefined,
    })
  } else {
    drawWorld(ctx, world, viewW, viewH, fx, {
      dim: mode === 'title' || mode === 'matchmaking' ? 0.14 : 0,
      time: ts * 0.001,
    })
  }
  const t2 = performance.now()

  fps.frame(ts, {
    simMs: t1 - t0,
    drawMs: t2 - t1,
    extra: `${world.worm.points.length}p ${canvas.width}x${canvas.height}`,
  })
  rafId = requestAnimationFrame(frame)
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
