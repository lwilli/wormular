import type { GameEvent } from '../core/types'

const FOOD_GOLD = '#FFD24A'
const FOOD_HOT = '#FFF4C8'

const EAT_LIFE = 0.15
const PLUS_LIFE = 0.45
const DEATH_FREEZE = 0.18
const SHAKE_LIFE = 0.22
const SHAKE_PX = 3.5
const FLASH_LIFE = 0.18

type Speck = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  color: string
  size: number
}

type Pop = {
  x: number
  y: number
  radius: number
  color: string
  life: number
  age: number
}

type PlusOne = {
  x: number
  y: number
  life: number
  age: number
}

export type FxState = {
  pops: Pop[]
  specks: Speck[]
  plusOnes: PlusOne[]
  shakeAge: number
  shakeLife: number
  flashAge: number
  flashLife: number
  freezeLeft: number
  deathPending: boolean
}

const shakeOut = { x: 0, y: 0 }

export function createFx(): FxState {
  return {
    pops: [],
    specks: [],
    plusOnes: [],
    shakeAge: 0,
    shakeLife: 0,
    flashAge: 0,
    flashLife: 0,
    freezeLeft: 0,
    deathPending: false,
  }
}

export function clearFx(fx: FxState): void {
  fx.pops.length = 0
  fx.specks.length = 0
  fx.plusOnes.length = 0
  fx.shakeAge = 0
  fx.shakeLife = 0
  fx.flashAge = 0
  fx.flashLife = 0
  fx.freezeLeft = 0
  fx.deathPending = false
}

export function fxActive(fx: FxState): boolean {
  return (
    fx.pops.length > 0 ||
    fx.specks.length > 0 ||
    fx.plusOnes.length > 0 ||
    fx.deathPending ||
    fx.shakeAge < fx.shakeLife ||
    fx.flashAge < fx.flashLife
  )
}

export function handleGameEvent(fx: FxState, ev: GameEvent): void {
  if (ev.type === 'AteFood') {
    spawnEat(fx, ev.x, ev.y, ev.radius)
  } else if (ev.type === 'Died') {
    spawnDeath(fx)
  }
}

function spawnEat(
  fx: FxState,
  x: number,
  y: number,
  radius: number,
): void {
  fx.pops.push({ x, y, radius, color: FOOD_GOLD, life: EAT_LIFE, age: 0 })
  fx.plusOnes.push({ x, y, life: PLUS_LIFE, age: 0 })

  const n = 5 + Math.floor(Math.random() * 4)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = 40 + Math.random() * 90
    fx.specks.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.2 + Math.random() * 0.2,
      age: 0,
      color: i % 2 === 0 ? FOOD_GOLD : FOOD_HOT,
      size: 1.5 + Math.random() * 2.5,
    })
  }
}

function spawnDeath(fx: FxState): void {
  fx.freezeLeft = DEATH_FREEZE
  fx.shakeLife = SHAKE_LIFE
  fx.shakeAge = 0
  fx.flashLife = FLASH_LIFE
  fx.flashAge = 0
  fx.deathPending = true
}

/** Compact alive items in-place (no per-frame array alloc). */
function compactByAge<T extends { age: number; life: number }>(arr: T[]): void {
  let w = 0
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]!
    if (item.age < item.life) arr[w++] = item
  }
  arr.length = w
}

/** Advance FX. Returns true when a death freeze just finished (caller should go to title). */
export function updateFx(fx: FxState, dt: number): boolean {
  if (!fxActive(fx)) return false

  for (let i = 0; i < fx.pops.length; i++) fx.pops[i]!.age += dt
  compactByAge(fx.pops)

  for (let i = 0; i < fx.specks.length; i++) {
    const s = fx.specks[i]!
    s.age += dt
    s.x += s.vx * dt
    s.y += s.vy * dt
  }
  compactByAge(fx.specks)

  for (let i = 0; i < fx.plusOnes.length; i++) fx.plusOnes[i]!.age += dt
  compactByAge(fx.plusOnes)

  if (fx.shakeLife > 0) fx.shakeAge += dt
  if (fx.flashLife > 0) fx.flashAge += dt

  let deathDone = false
  if (fx.deathPending) {
    fx.freezeLeft -= dt
    if (fx.freezeLeft <= 0) {
      fx.deathPending = false
      fx.freezeLeft = 0
      deathDone = true
    }
  }
  return deathDone
}

export function isFreezing(fx: FxState): boolean {
  return fx.deathPending && fx.freezeLeft > 0
}

export function shakeOffset(fx: FxState): { x: number; y: number } {
  if (fx.shakeAge >= fx.shakeLife || fx.shakeLife <= 0) {
    shakeOut.x = 0
    shakeOut.y = 0
    return shakeOut
  }
  const t = 1 - fx.shakeAge / fx.shakeLife
  const mag = SHAKE_PX * t * t
  const a = fx.shakeAge * 62
  shakeOut.x = Math.cos(a) * mag
  shakeOut.y = Math.sin(a * 1.7) * mag
  return shakeOut
}

export function wormFlashOn(fx: FxState): boolean {
  if (fx.flashAge >= fx.flashLife || fx.flashLife <= 0) return false
  return Math.floor(fx.flashAge * 28) % 2 === 0
}

/** Draw eat/death overlays in arena (origin) space. */
export function drawFx(ctx: CanvasRenderingContext2D, fx: FxState): void {
  if (!fxActive(fx)) return

  for (let i = 0; i < fx.pops.length; i++) {
    const p = fx.pops[i]!
    const u = p.age / p.life
    const r = p.radius * (1 - u) * (1 + u * 0.35)
    ctx.globalAlpha = 1 - u
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  }

  for (let i = 0; i < fx.specks.length; i++) {
    const s = fx.specks[i]!
    const u = s.age / s.life
    ctx.globalAlpha = 1 - u
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size * (1 - u * 0.5), 0, Math.PI * 2)
    ctx.fillStyle = s.color
    ctx.fill()
  }

  if (fx.plusOnes.length > 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#F2F4F8'
    for (let i = 0; i < fx.plusOnes.length; i++) {
      const p = fx.plusOnes[i]!
      const u = p.age / p.life
      ctx.globalAlpha = 1 - u
      ctx.fillText('+1', p.x, p.y - 12 - u * 28)
    }
  }

  ctx.globalAlpha = 1
}
