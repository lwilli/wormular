import './style.css'
import {
  ARENA_PADDING_PX,
  FIXED_DT,
  TITLE_RESTART_COOLDOWN_MS,
} from './core/config'
import { createWorld, step, stepAttract } from './core/world'
import type { World } from './core/types'
import { createFpsMeter } from './debug/fps'
import {
  clearFx,
  createFx,
  handleGameEvent,
  isFreezing,
  updateFx,
} from './fx/effects'
import { createHoldInput } from './input/hold'
import { createAudio } from './platform/audio'
import { initStorage, recordScore, loadHighScore } from './platform/storage'
import { drawWorld } from './render/draw'
import { bindTitleUi } from './ui/title'

type Mode = 'title' | 'playing' | 'dying'

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
const input = createHoldInput(canvas)
const audio = createAudio()
const fx = createFx()
const fps = createFpsMeter()

let mode: Mode = 'title'
let highScore = loadHighScore()
let viewW = Math.max(1, window.innerWidth)
let viewH = Math.max(1, window.innerHeight)
let world = createAttractWorld()
let accum = 0
let lastTs = performance.now()
/** After death, ignore start until cooldown elapses and the player fully releases. */
let awaitReleaseBeforeStart = false
let titleReadyAt = 0
let lastHudScore = -1

ui.setHighScore(highScore)
ui.setVisible(true)
ui.setHudVisible(false)
ui.setSoundEnabled(audio.isEnabled())

ui.onPlay(() => {
  audio.unlock()
  requestStart()
})
ui.onSoundToggle(() => {
  const enabled = audio.toggle()
  ui.setSoundEnabled(enabled)
})

void initStorage().then(() => {
  highScore = loadHighScore()
  ui.setHighScore(highScore)
})

function arenaRadius(): number {
  const side = Math.min(viewW, viewH)
  return Math.max(80, side * 0.5 - ARENA_PADDING_PX)
}

function createAttractWorld(): World {
  return createWorld(arenaRadius(), 42, { attract: true })
}

function createPlayWorld(): World {
  return createWorld(arenaRadius(), Date.now())
}

function startGame(): void {
  mode = 'playing'
  world = createPlayWorld()
  clearFx(fx)
  awaitReleaseBeforeStart = false
  // Leave input.holding as-is (true only while finger/key is actually down).
  input.playRequested = false
  audio.unlock()
  lastHudScore = -1
  ui.setVisible(false)
  ui.setHudVisible(true)
  ui.setScore(0)
}

function returnToTitle(): void {
  highScore = recordScore(world.score)
  ui.setHighScore(highScore)
  mode = 'title'
  world = createAttractWorld()
  clearFx(fx)
  input.holding = false
  input.playRequested = false
  awaitReleaseBeforeStart = true
  titleReadyAt = performance.now() + TITLE_RESTART_COOLDOWN_MS
  ui.setVisible(true)
  ui.setHudVisible(false)
}

/** Start only on a fresh intentional press after death cooldown + release. */
function requestStart(): void {
  if (mode !== 'title') return
  if (awaitReleaseBeforeStart) return
  if (performance.now() < titleReadyAt) return
  startGame()
}

function resize(): void {
  // Prefer visualViewport when present (iOS WKWebView / browser chrome).
  const vv = window.visualViewport
  viewW = Math.max(1, Math.round(vv?.width ?? window.innerWidth))
  viewH = Math.max(1, Math.round(vv?.height ?? window.innerHeight))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // Cap backing-store size — full Retina desktop canvases are expensive in Canvas2D.
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
  if (Math.abs(world.R - R) > 2) {
    world = mode === 'title' ? createAttractWorld() : createPlayWorld()
  }
}

window.addEventListener('resize', resize)
window.visualViewport?.addEventListener('resize', resize)
window.visualViewport?.addEventListener('scroll', resize)
resize()

function frame(ts: number): void {
  // A newer module boot (Vite HMR) supersedes this loop.
  if (myGen !== boot.gen) return

  const rawDt = Math.min(0.05, (ts - lastTs) / 1000)
  lastTs = ts
  accum += rawDt

  if (mode === 'title') {
    if (awaitReleaseBeforeStart) {
      // Swallow held taps / Play spam from the death mash; arm only after release.
      input.playRequested = false
      if (ts >= titleReadyAt && !input.holding) {
        awaitReleaseBeforeStart = false
      }
    } else if (input.playRequested || input.holding) {
      requestStart()
    }
  }

  const t0 = performance.now()
  while (accum >= FIXED_DT) {
    accum -= FIXED_DT
    if (mode === 'title') {
      stepAttract(world, FIXED_DT)
    } else if (mode === 'playing' && !isFreezing(fx)) {
      step(world, { holding: input.holding }, FIXED_DT)
      for (const ev of world.events) {
        handleGameEvent(fx, ev)
        if (ev.type === 'AteFood') audio.playEat()
        else if (ev.type === 'Died') {
          audio.playCrash()
          mode = 'dying'
        }
      }
      if (world.score !== lastHudScore) {
        lastHudScore = world.score
        ui.setScore(world.score)
      }
    }
  }

  if (updateFx(fx, rawDt) && mode === 'dying') {
    returnToTitle()
  }
  const t1 = performance.now()

  drawWorld(ctx, world, viewW, viewH, fx, {
    dim: mode === 'title' ? 0.22 : 0,
    time: ts * 0.001,
  })
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
    // Only cancel THIS module's rAF — never bump gen here (new module owns that).
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    window.visualViewport?.removeEventListener('resize', resize)
    window.visualViewport?.removeEventListener('scroll', resize)
    input.destroy()
    fps.dispose()
  })
}
