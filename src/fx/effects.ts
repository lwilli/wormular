import type { DeathCause, GameEvent } from '../core/types'

const FOOD_GOLD = '#FFD24A'
const FOOD_HOT = '#FFF4C8'

const EAT_LIFE = 0.15
const PLUS_LIFE = 0.45
/** How long the head→tail digest glow runs after an eat. */
const EAT_GLOW_LIFE = 0.42
const DEATH_FREEZE = 0.18
const SUCK_LIFE = 0.62
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

export type DeathFx = 'crash' | 'suck'

export type FxState = {
  pops: Pop[]
  specks: Speck[]
  plusOnes: PlusOne[]
  shakeAge: number
  shakeLife: number
  flashAge: number
  flashLife: number
  /** Head→tail yellow digest wave after eating. */
  eatGlowAge: number
  eatGlowLife: number
  freezeLeft: number
  deathPending: boolean
  deathFx: DeathFx | null
  suckAge: number
  suckLife: number
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
    eatGlowAge: 0,
    eatGlowLife: 0,
    freezeLeft: 0,
    deathPending: false,
    deathFx: null,
    suckAge: 0,
    suckLife: 0,
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
  fx.eatGlowAge = 0
  fx.eatGlowLife = 0
  fx.freezeLeft = 0
  fx.deathPending = false
  fx.deathFx = null
  fx.suckAge = 0
  fx.suckLife = 0
}

export function fxActive(fx: FxState): boolean {
  return (
    fx.pops.length > 0 ||
    fx.specks.length > 0 ||
    fx.plusOnes.length > 0 ||
    fx.deathPending ||
    fx.shakeAge < fx.shakeLife ||
    fx.flashAge < fx.flashLife ||
    fx.eatGlowAge < fx.eatGlowLife
  )
}

export function handleGameEvent(fx: FxState, ev: GameEvent): void {
  if (ev.type === 'AteFood') {
    spawnEat(fx, ev.x, ev.y, ev.radius)
  } else if (ev.type === 'Died') {
    spawnDeath(fx, ev.cause)
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
  fx.eatGlowLife = EAT_GLOW_LIFE
  fx.eatGlowAge = 0

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

function spawnDeath(fx: FxState, cause: DeathCause): void {
  fx.deathPending = true
  if (cause === 'center') {
    fx.deathFx = 'suck'
    fx.suckLife = SUCK_LIFE
    fx.suckAge = 0
    fx.freezeLeft = SUCK_LIFE
    fx.shakeLife = 0
    fx.shakeAge = 0
    fx.flashLife = 0
    fx.flashAge = 0
    spawnSuckDebris(fx)
    return
  }

  fx.deathFx = 'crash'
  fx.suckLife = 0
  fx.suckAge = 0
  fx.freezeLeft = DEATH_FREEZE
  fx.shakeLife = SHAKE_LIFE
  fx.shakeAge = 0
  fx.flashLife = FLASH_LIFE
  fx.flashAge = 0
}

/** Tiny motes that fall straight into the hole with the worm. */
function spawnSuckDebris(fx: FxState): void {
  const n = 10
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 28 + Math.random() * 70
    const inward = 70 + Math.random() * 110
    fx.specks.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      vx: -Math.cos(a) * inward,
      vy: -Math.sin(a) * inward,
      life: 0.45 + Math.random() * 0.35,
      age: 0,
      color: i % 2 === 0 ? '#c8b0ff' : '#6aa8ff',
      size: 1.2 + Math.random() * 2,
    })
  }
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
    if (fx.deathFx === 'suck') {
      // Extra radial pull toward origin while the hole is feeding.
      const pull = 3.4 * dt
      s.vx += -s.x * pull
      s.vy += -s.y * pull
    }
    s.x += s.vx * dt
    s.y += s.vy * dt
  }
  compactByAge(fx.specks)

  for (let i = 0; i < fx.plusOnes.length; i++) fx.plusOnes[i]!.age += dt
  compactByAge(fx.plusOnes)

  if (fx.shakeLife > 0) fx.shakeAge += dt
  if (fx.flashLife > 0) fx.flashAge += dt
  if (fx.eatGlowLife > 0) fx.eatGlowAge += dt
  if (fx.suckLife > 0) fx.suckAge += dt

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

/** 0–1 progress of the black-hole swallow, or 0 when inactive. */
export function suckProgress(fx: FxState): number {
  if (fx.deathFx !== 'suck' || fx.suckLife <= 0) return 0
  return Math.min(1, fx.suckAge / fx.suckLife)
}

/**
 * 0–1 progress of the eat digest glow (0 = at head, 1 = leaving the tail),
 * or `null` when inactive.
 */
export function eatGlowProgress(fx: FxState): number | null {
  if (fx.eatGlowLife <= 0 || fx.eatGlowAge >= fx.eatGlowLife) return null
  return Math.min(1, fx.eatGlowAge / fx.eatGlowLife)
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
  if (fx.deathFx === 'suck') return false
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
    const dist = Math.hypot(s.x, s.y)
    // Fade harder once debris crosses the event horizon.
    const holeFade = fx.deathFx === 'suck' ? Math.min(1, dist / 18) : 1
    ctx.globalAlpha = (1 - u) * holeFade
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size * (1 - u * 0.5) * holeFade, 0, Math.PI * 2)
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
