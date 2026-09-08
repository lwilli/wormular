import './style.css'
import {
  ARENA_PADDING_PX,
  FIXED_DT,
  TITLE_RESTART_COOLDOWN_MS,
} from './core/config'
import { createWorld, step, stepAttract } from './core/world'
import type { World } from './core/types'
import { createHoldInput } from './input/hold'
import { recordScore, loadHighScore } from './platform/storage'
import { drawWorld } from './render/draw'
import { bindTitleUi } from './ui/title'

type Mode = 'title' | 'playing'

const canvasEl = document.querySelector('#game')
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('Missing #game canvas')
}
const canvas: HTMLCanvasElement = canvasEl
const ctxRaw = canvas.getContext('2d')
if (!ctxRaw) throw new Error('2D context unavailable')
const ctx: CanvasRenderingContext2D = ctxRaw

const ui = bindTitleUi()
const input = createHoldInput(canvas)

let mode: Mode = 'title'
let highScore = loadHighScore()
let world = createAttractWorld()
let accum = 0
let lastTs = performance.now()
/** After death, ignore start until cooldown elapses and the player fully releases. */
let awaitReleaseBeforeStart = false
let titleReadyAt = 0

ui.setHighScore(highScore)
ui.setVisible(true)
ui.setHudVisible(false)

ui.onPlay(() => requestStart())

function arenaRadius(): number {
  const side = Math.min(window.innerWidth, window.innerHeight)
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
  awaitReleaseBeforeStart = false
  // Leave input.holding as-is (true only while finger/key is actually down).
  input.playRequested = false
  ui.setVisible(false)
  ui.setHudVisible(true)
  ui.setScore(0)
}

function returnToTitle(): void {
  highScore = recordScore(world.score)
  ui.setHighScore(highScore)
  mode = 'title'
  world = createAttractWorld()
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const R = arenaRadius()
  if (mode === 'title' && Math.abs(world.R - R) > 2) {
    world = createAttractWorld()
  }
}

window.addEventListener('resize', resize)
resize()

function frame(ts: number): void {
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

  while (accum >= FIXED_DT) {
    accum -= FIXED_DT
    if (mode === 'title') {
      stepAttract(world, FIXED_DT)
    } else {
      step(world, { holding: input.holding }, FIXED_DT)
      ui.setScore(world.score)
      if (!world.alive) {
        returnToTitle()
        break
      }
    }
  }

  drawWorld(ctx, world, window.innerWidth, window.innerHeight)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
