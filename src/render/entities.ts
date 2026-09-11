import type { Apple, Rock, World } from '../core/types'
import { headPos } from '../core/worm'
import { PALETTE } from './palette'
import { clamp, hash01 } from './util'

const POP_IN = 0.18
const rockBorn = new Map<number, number>()
let popSeed = Number.NaN
let appleKey = ''
let appleBorn = 0

/** Remember when each rock/apple first appeared so they can pop in. */
export function syncSpawnPops(world: World, t: number): void {
  if (world.seed !== popSeed) {
    popSeed = world.seed
    rockBorn.clear()
    appleKey = ''
  }

  for (const id of rockBorn.keys()) {
    if (!world.rocks.some((r) => r.id === id)) rockBorn.delete(id)
  }
  for (let i = 0; i < world.rocks.length; i++) {
    const id = world.rocks[i]!.id
    if (!rockBorn.has(id)) rockBorn.set(id, t)
  }

  const apple = world.apple
  const key = apple ? `${apple.x.toFixed(2)},${apple.y.toFixed(2)}` : ''
  if (key !== appleKey) {
    appleKey = key
    appleBorn = t
  }
}

function popScale(born: number, t: number): number {
  const u = clamp((t - born) / POP_IN, 0, 1)
  return 0.08 + 0.92 * (1 - (1 - u) * (1 - u) * (1 - u))
}

function withPop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  draw: () => void,
): void {
  if (scale >= 0.995) {
    draw()
    return
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.translate(-x, -y)
  draw()
  ctx.restore()
}

export function drawHazards(
  ctx: CanvasRenderingContext2D,
  rocks: Rock[],
  t: number,
): void {
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]!
    const born = rockBorn.get(rock.id) ?? t
    withPop(ctx, rock.x, rock.y, popScale(born, t), () => drawHazard(ctx, rock))
  }
}

function drawHazard(ctx: CanvasRenderingContext2D, rock: Rock): void {
  const kind = rock.id % 3
  if (kind === 1) drawPlanet(ctx, rock)
  else if (kind === 2) drawComet(ctx, rock)
  else drawAsteroid(ctx, rock)
}

function drawAsteroid(ctx: CanvasRenderingContext2D, rock: Rock): void {
  const { x, y, radius, id } = rock
  const n = 8 + (id % 3)
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash01(id * 3.1) * 0.35
    const j = 0.7 + hash01(id * 13 + i) * 0.28
    const px = x + Math.cos(a) * radius * j
    const py = y + Math.sin(a) * radius * j
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = PALETTE.hazard
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = PALETTE.hazardRim
  ctx.stroke()

  ctx.fillStyle = PALETTE.hazardShade
  blobPath(
    ctx,
    x + (hash01(id) - 0.5) * radius * 0.4,
    y + (hash01(id + 2) - 0.5) * radius * 0.4,
    radius * (0.2 + hash01(id * 7) * 0.14),
    id + 3,
    6,
    0.35,
  )
  ctx.fill()
  blobPath(
    ctx,
    x + (hash01(id + 5) - 0.5) * radius * 0.45,
    y + (hash01(id + 8) - 0.5) * radius * 0.4,
    radius * 0.14,
    id + 6,
    5,
    0.4,
  )
  ctx.fill()

  ctx.fillStyle = PALETTE.hazardLit
  ctx.globalAlpha = 0.35
  blobPath(
    ctx,
    x - radius * 0.22,
    y - radius * 0.22,
    radius * 0.22,
    id + 9,
    5,
    0.3,
  )
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawPlanet(ctx: CanvasRenderingContext2D, rock: Rock): void {
  const { x, y, radius, id } = rock
  const len = Math.hypot(x, y) || 1
  const lx = -x / len
  const ly = -y / len
  const fill = id % 2 === 0 ? PALETTE.planetA : PALETTE.planetB

  blobPath(ctx, x, y, radius, id, 16, 0.08)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = PALETTE.planetRim
  ctx.stroke()

  ctx.save()
  blobPath(ctx, x, y, radius, id, 16, 0.08)
  ctx.clip()

  const lit = ctx.createRadialGradient(
    x + lx * radius * 0.35,
    y + ly * radius * 0.35,
    radius * 0.08,
    x - lx * radius * 0.2,
    y - ly * radius * 0.2,
    radius * 1.2,
  )
  lit.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  lit.addColorStop(0.4, 'rgba(255, 255, 255, 0.04)')
  lit.addColorStop(1, 'rgba(0, 0, 0, 0.45)')
  ctx.fillStyle = lit
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)

  ctx.globalAlpha = 0.5
  ctx.fillStyle = PALETTE.planetBand
  blobPath(
    ctx,
    x + (hash01(id) - 0.45) * radius * 0.3,
    y + (hash01(id + 3) - 0.5) * radius * 0.25,
    radius * 0.32,
    id + 4,
    8,
    0.3,
  )
  ctx.fill()
  ctx.fillStyle = 'rgba(10, 12, 24, 0.35)'
  blobPath(
    ctx,
    x - lx * radius * 0.2,
    y + (hash01(id + 8) - 0.5) * radius * 0.35,
    radius * 0.18,
    id + 9,
    7,
    0.35,
  )
  ctx.fill()
  ctx.restore()
}

function drawComet(ctx: CanvasRenderingContext2D, rock: Rock): void {
  const { x, y, radius, id } = rock
  const len = Math.hypot(x, y) || 1
  const ux = x / len
  const uy = y / len
  const tail = radius * 2.5

  ctx.lineCap = 'round'
  ctx.strokeStyle = PALETTE.cometIce
  for (let i = 0; i < 3; i++) {
    const spread = (i - 1) * 0.34
    const tlen = tail * (1 - Math.abs(i - 1) * 0.22)
    ctx.globalAlpha = i === 1 ? 0.22 : 0.1
    ctx.lineWidth = i === 1 ? radius * 0.28 : radius * 0.12
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(
      x + ux * tlen - uy * radius * spread,
      y + uy * tlen + ux * radius * spread,
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  blobPath(ctx, x, y, radius * 0.84, id, 8, 0.16)
  ctx.fillStyle = PALETTE.cometBody
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = PALETTE.cometIce
  ctx.stroke()

  ctx.fillStyle = 'rgba(220, 250, 255, 0.45)'
  blobPath(
    ctx,
    x - ux * radius * 0.18,
    y - uy * radius * 0.18,
    radius * 0.28,
    id + 6,
    6,
    0.3,
  )
  ctx.fill()
}

function blobPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  id: number,
  points: number,
  jitter: number,
): void {
  ctx.beginPath()
  let prevX = 0
  let prevY = 0
  for (let i = 0; i <= points; i++) {
    const k = i % points
    const a = (k / points) * Math.PI * 2 + hash01(id * 2.7) * 0.4
    const rr = radius * (1 - jitter + hash01(id * 13 + k) * jitter)
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.quadraticCurveTo(prevX, prevY, (prevX + px) * 0.5, (prevY + py) * 0.5)
    prevX = px
    prevY = py
  }
  ctx.closePath()
}

export function drawStarFruit(
  ctx: CanvasRenderingContext2D,
  apple: Apple,
  t: number,
): void {
  const { x, y, radius } = apple
  const pulse = 1 + 0.08 * Math.sin(t * 4.2)
  const r = radius * pulse
  withPop(ctx, x, y, popScale(appleBorn, t), () => {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.3)
    glow.addColorStop(0, 'rgba(255, 248, 210, 0.55)')
    glow.addColorStop(0.35, 'rgba(255, 210, 74, 0.28)')
    glow.addColorStop(1, 'rgba(255, 210, 74, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - r * 2.3, y - r * 2.3, r * 4.6, r * 4.6)

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    starPath(ctx, x, y, r * 1.02, r * 0.5, 5, t)
    ctx.fillStyle = PALETTE.food
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = PALETTE.foodHot
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x - r * 0.16, y - r * 0.18, r * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.fill()
  })
}

function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  points: number,
  t: number,
): void {
  // Rounded lobes (quadratic through each tip) instead of sharp spikes.
  ctx.beginPath()
  for (let i = 0; i < points; i++) {
    const a = -Math.PI * 0.5 + (i * 2 * Math.PI) / points
    const wobble = 1 + 0.04 * Math.sin(t * 3.2 + i)
    const notch = inner * wobble
    const tip = outer * wobble
    const a0 = a - Math.PI / points
    const a1 = a + Math.PI / points
    const x0 = x + Math.cos(a0) * notch
    const y0 = y + Math.sin(a0) * notch
    const tx = x + Math.cos(a) * tip
    const ty = y + Math.sin(a) * tip
    const x1 = x + Math.cos(a1) * notch
    const y1 = y + Math.sin(a1) * notch
    if (i === 0) ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(tx, ty, x1, y1)
  }
  ctx.closePath()
}

export function drawWorm(
  ctx: CanvasRenderingContext2D,
  world: World,
  thickness: number,
  flash: boolean,
  danger: number,
  /** 0–1 black-hole swallow. 0 = normal. */
  suck = 0,
  /** 0–1 head→tail digest glow, or null when idle. */
  eatGlow: number | null = null,
): void {
  const deposited = world.worm.points
  if (deposited.length === 0) return

  const fill = flash ? PALETTE.wormFlash : PALETTE.wormFill
  const outline = flash ? '#ffffff' : PALETTE.wormOutline
  const gloss = flash ? '#ffffff' : PALETTE.wormGloss
  const liveHead = headPos(world.worm)

  const sucking = suck > 0.001
  const u = sucking ? suckEase(suck) : 0
  // Head leads into the hole; tail lags a beat behind.
  const head = sucking
    ? suckPoint(liveHead.x, liveHead.y, u, 1)
    : liveHead
  const body = sucking
    ? suckBody(deposited, u)
    : deposited

  const thickScale = sucking ? Math.max(0.08, (1 - u) ** 1.15) : 1
  const th = thickness * thickScale
  const alpha = sucking ? Math.max(0, 1 - u * u * 1.05) : 1
  if (alpha < 0.02) return

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const glowA = (0.22 + danger * 0.35) * alpha
  ctx.globalAlpha = glowA
  strokeWormPath(ctx, head, body, th + 12 * thickScale, PALETTE.wormFill)
  if (danger > 0.35 && !sucking) {
    ctx.globalAlpha = danger * 0.45
    strokeWormPath(ctx, head, body, th + 18, '#ff5030')
  }
  ctx.globalAlpha = alpha

  strokeWormPath(ctx, head, body, th + 4 * thickScale, outline)
  strokeWormPath(ctx, head, body, th, fill)
  strokeWormPath(ctx, head, body, th * 0.38, gloss)

  // Starfruit digest: yellow glow sweeps head → tail under the gloss.
  if (eatGlow !== null && !flash && !sucking) {
    drawEatGlow(ctx, head, body, th, eatGlow, alpha)
  }

  // Once deep in the hole, drop the face — it's already swallowed.
  if (u < 0.82) {
    ctx.beginPath()
    ctx.arc(head.x, head.y, th * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 2 * thickScale
    ctx.strokeStyle = outline
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(
      head.x - th * 0.12,
      head.y - th * 0.14,
      th * 0.16,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.fill()

    if (u < 0.55) {
      let tx = Math.cos(world.worm.theta)
      let ty = Math.sin(world.worm.theta)
      const newest = body[body.length - 1]!
      const dx = head.x - newest.x
      const dy = head.y - newest.y
      const len = Math.hypot(dx, dy)
      if (len > 0.05) {
        tx = dx / len
        ty = dy / len
      } else if (body.length > 1) {
        const prev = body[body.length - 2]!
        const dx2 = head.x - prev.x
        const dy2 = head.y - prev.y
        const len2 = Math.hypot(dx2, dy2) || 1
        tx = dx2 / len2
        ty = dy2 / len2
      }
      const nx = -ty
      const ny = tx
      const eyeDist = th * 0.28
      const eyeForward = th * 0.2
      const eyeA = 1 - u / 0.55
      ctx.globalAlpha = alpha * eyeA
      drawEye(
        ctx,
        head.x + tx * eyeForward + nx * eyeDist,
        head.y + ty * eyeForward + ny * eyeDist,
        th * 0.12,
      )
      drawEye(
        ctx,
        head.x + tx * eyeForward - nx * eyeDist,
        head.y + ty * eyeForward - ny * eyeDist,
        th * 0.12,
      )
    }
  }

  ctx.restore()
}

/** Ease-in so the last moments accelerate into the singularity. */
function suckEase(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (2.2 - 1.2 * x)
}

/**
 * Pull a point straight into the origin (radial collapse).
 * `lead` 0 = tail, 1 = head (head gets eaten first).
 */
function suckPoint(
  x: number,
  y: number,
  u: number,
  lead: number,
): { x: number; y: number } {
  const local = Math.min(1, u * (0.72 + lead * 0.55))
  const scale = (1 - local) ** 1.65
  return { x: x * scale, y: y * scale }
}

/** Scratch buffer reused each frame to avoid GC during the death anim. */
const suckScratch: { x: number; y: number }[] = []

function suckBody(
  deposited: { x: number; y: number }[],
  u: number,
): { x: number; y: number }[] {
  const n = deposited.length
  if (suckScratch.length < n) {
    for (let i = suckScratch.length; i < n; i++) {
      suckScratch.push({ x: 0, y: 0 })
    }
  }
  for (let i = 0; i < n; i++) {
    // Index 0 = oldest (tail). Head-adjacent samples lead.
    const lead = n <= 1 ? 1 : i / (n - 1)
    const p = deposited[i]!
    const out = suckScratch[i]!
    const s = suckPoint(p.x, p.y, u, lead)
    out.x = s.x
    out.y = s.y
  }
  suckScratch.length = n
  return suckScratch
}

function strokeWormPath(
  ctx: CanvasRenderingContext2D,
  head: { x: number; y: number },
  deposited: { x: number; y: number }[],
  width: number,
  color: string,
): void {
  const newest = deposited[deposited.length - 1]!
  const headGap = Math.hypot(head.x - newest.x, head.y - newest.y)
  const count = deposited.length + (headGap >= 0.05 ? 1 : 0)
  if (count < 2) {
    ctx.beginPath()
    ctx.arc(head.x, head.y, width * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(deposited[0]!.x, deposited[0]!.y)
  for (let i = 1; i < deposited.length; i++) {
    ctx.lineTo(deposited[i]!.x, deposited[i]!.y)
  }
  if (headGap >= 0.05) ctx.lineTo(head.x, head.y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

/**
 * Soft yellow blob that travels head→tail — reads as starfruit moving inside.
 * `progress` 0 = head, 1 = tail exit. lead 0 = tail, 1 = head (same as suck).
 */
function drawEatGlow(
  ctx: CanvasRenderingContext2D,
  head: { x: number; y: number },
  deposited: { x: number; y: number }[],
  thickness: number,
  progress: number,
  alpha: number,
): void {
  const newest = deposited[deposited.length - 1]!
  const headGap = Math.hypot(head.x - newest.x, head.y - newest.y)
  const includeHead = headGap >= 0.05
  const n = deposited.length + (includeHead ? 1 : 0)
  if (n < 1) return

  // Wave center: head at start, exits past the tip of the tail at the end.
  const wavePos = 1 - progress
  const envelope = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15
  const band = 0.14
  const band2 = band * band

  // Sample a few bright spots along the wave instead of every trail point.
  const samples = Math.max(5, Math.min(18, Math.floor(n * band * 3)))
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let s = 0; s <= samples; s++) {
    const lead = s / samples
    const d = lead - wavePos
    const w = Math.exp((-d * d) / (2 * band2))
    if (w < 0.05) continue

    const p = pointAlongWorm(head, deposited, includeHead, lead)
    const intensity = w * envelope * alpha
    const r = thickness * (0.5 + 0.65 * w)

    ctx.globalAlpha = intensity * 0.7
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.55)
    g.addColorStop(0, 'rgba(255, 244, 200, 0.95)')
    g.addColorStop(0.4, 'rgba(255, 210, 74, 0.5)')
    g.addColorStop(1, 'rgba(255, 210, 74, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 1.55, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/** Interpolate a point along the worm polyline by lead (0 = tail, 1 = head). */
function pointAlongWorm(
  head: { x: number; y: number },
  deposited: { x: number; y: number }[],
  includeHead: boolean,
  lead: number,
): { x: number; y: number } {
  const n = deposited.length + (includeHead ? 1 : 0)
  if (n <= 1) return head
  const t = lead * (n - 1)
  const i0 = Math.floor(t)
  const i1 = Math.min(n - 1, i0 + 1)
  const frac = t - i0
  const a = wormPointAt(head, deposited, includeHead, i0)
  const b = wormPointAt(head, deposited, includeHead, i1)
  return {
    x: a.x + (b.x - a.x) * frac,
    y: a.y + (b.y - a.y) * frac,
  }
}

function wormPointAt(
  head: { x: number; y: number },
  deposited: { x: number; y: number }[],
  includeHead: boolean,
  index: number,
): { x: number; y: number } {
  if (includeHead && index >= deposited.length) return head
  return deposited[Math.min(index, deposited.length - 1)]!
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.eye
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.eyeHighlight
  ctx.fill()
}
