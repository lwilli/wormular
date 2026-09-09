import { PALETTE } from './palette'
import { clamp, hash01, lerp } from './util'

type Layer = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  key: string
}

let starfield: Layer | null = null
let nebula: Layer | null = null
let vortexDisc: Layer | null = null
let spiralLayer: Layer | null = null

function makeLayer(w: number, h: number, key: string): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('2D context unavailable')
  return { canvas, ctx, key }
}

function ensureLayer(
  current: Layer | null,
  w: number,
  h: number,
  key: string,
): Layer {
  if (current && current.key === key) return current
  return makeLayer(w, h, key)
}

function paintStarfield(layer: Layer): void {
  const { canvas, ctx } = layer
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const n = 90
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 19.1) * canvas.width
    const y = hash01(i * 47.3 + 2.2) * canvas.height
    const bright = hash01(i * 3.7 + 8)
    const size = bright > 0.92 ? 2 : 1
    ctx.fillStyle =
      bright > 0.85
        ? `rgba(255, 224, 160, ${0.45 + bright * 0.4})`
        : `rgba(200, 214, 255, ${0.18 + bright * 0.45})`
    ctx.fillRect(x, y, size, size)
  }

  // A few slightly larger "pixels" so the field reads at a glance.
  for (let i = 0; i < 8; i++) {
    const x = hash01(i * 91.2 + 4) * canvas.width
    const y = hash01(i * 13.8 + 9) * canvas.height
    ctx.fillStyle = 'rgba(255, 236, 180, 0.7)'
    ctx.fillRect(x, y, 2, 2)
    ctx.fillStyle = 'rgba(180, 200, 255, 0.35)'
    ctx.fillRect(x + 2, y, 1, 1)
  }
}

function paintNebula(layer: Layer): void {
  const { canvas, ctx } = layer
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const blobs = [
    { x: 0.5, y: 0.42, r: 0.42, c: '90, 60, 190' },
    { x: 0.32, y: 0.58, r: 0.3, c: '40, 90, 180' },
    { x: 0.7, y: 0.55, r: 0.28, c: '120, 50, 160' },
    { x: 0.48, y: 0.72, r: 0.22, c: '50, 110, 170' },
  ]
  for (const b of blobs) {
    const x = b.x * canvas.width
    const y = b.y * canvas.height
    const r = b.r * canvas.width
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${b.c}, 0.7)`)
    g.addColorStop(0.55, `rgba(${b.c}, 0.22)`)
    g.addColorStop(1, `rgba(${b.c}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  // Cheap dither so the blobs feel pixel-arcade rather than airbrushed.
  for (let i = 0; i < 280; i++) {
    const x = (hash01(i * 5.1) * canvas.width) | 0
    const y = (hash01(i * 9.7 + 3) * canvas.height) | 0
    const a = 0.04 + hash01(i * 2.2) * 0.08
    ctx.fillStyle = hash01(i) > 0.5 ? `rgba(80, 90, 180, ${a})` : `rgba(20, 16, 40, ${a})`
    ctx.fillRect(x, y, 1, 1)
  }

  for (let i = 0; i < 28; i++) {
    const x = hash01(i * 23.3) * canvas.width
    const y = hash01(i * 41.9 + 1) * canvas.height
    ctx.fillStyle = `rgba(220, 230, 255, ${0.35 + hash01(i) * 0.5})`
    ctx.fillRect(x, y, hash01(i + 2) > 0.85 ? 2 : 1, 1)
  }
}

function paintVortexDisc(layer: Layer, RCore: number): void {
  const { canvas, ctx } = layer
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width * 0.5
  const cy = canvas.height * 0.5
  const scale = canvas.width / (RCore * 3.2)
  const rBloom = RCore * 1.6 * scale

  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, rBloom)
  bloom.addColorStop(0, 'rgba(12, 8, 22, 0.95)')
  bloom.addColorStop(0.18, 'rgba(110, 48, 190, 0.78)')
  bloom.addColorStop(0.4, 'rgba(70, 100, 220, 0.48)')
  bloom.addColorStop(0.7, 'rgba(40, 50, 140, 0.12)')
  bloom.addColorStop(1, 'rgba(10, 12, 30, 0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const disk = ctx.createRadialGradient(
    cx,
    cy,
    RCore * 0.2 * scale,
    cx,
    cy,
    RCore * 1.05 * scale,
  )
  disk.addColorStop(0, 'rgba(8, 4, 14, 0)')
  disk.addColorStop(0.28, 'rgba(150, 95, 240, 0.62)')
  disk.addColorStop(0.58, 'rgba(60, 120, 230, 0.38)')
  disk.addColorStop(1, 'rgba(40, 60, 140, 0)')
  ctx.fillStyle = disk
  ctx.beginPath()
  ctx.arc(cx, cy, RCore * 1.05 * scale, 0, Math.PI * 2)
  ctx.fill()
}

function starfieldLayer(viewW: number, viewH: number): Layer {
  const pw = Math.max(80, Math.floor(viewW * 0.45))
  const ph = Math.max(80, Math.floor(viewH * 0.45))
  const key = `${pw}x${ph}`
  const next = ensureLayer(starfield, pw, ph, key)
  if (next !== starfield) {
    paintStarfield(next)
    starfield = next
  }
  return next
}

function nebulaLayer(R: number): Layer {
  const size = Math.max(64, Math.floor(R * 0.7))
  const key = `n${size}`
  const next = ensureLayer(nebula, size, size, key)
  if (next !== nebula) {
    paintNebula(next)
    nebula = next
  }
  return next
}

function vortexDiscLayer(RCore: number): Layer {
  const size = Math.max(48, Math.floor(RCore * 3.2))
  const key = `v3${size}`
  const next = ensureLayer(vortexDisc, size, size, key)
  if (next !== vortexDisc) {
    paintVortexDisc(next, RCore)
    vortexDisc = next
  }
  return next
}

function paintSpirals(layer: Layer, RCore: number): void {
  const { canvas, ctx } = layer
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width * 0.5
  const cy = canvas.height * 0.5
  const scale = canvas.width / (RCore * 3)
  ctx.save()
  ctx.translate(cx, cy)
  drawSpiralArms(ctx, RCore * 0.5 * scale, RCore * 1.28 * scale, 0)
  ctx.restore()
}

function spiralArmsLayer(RCore: number): Layer {
  const size = Math.max(48, Math.floor(RCore * 3))
  const key = `s3${size}`
  const next = ensureLayer(spiralLayer, size, size, key)
  if (next !== spiralLayer) {
    paintSpirals(next, RCore)
    spiralLayer = next
  }
  return next
}

/** Deep space behind the arena. Screen space. */
export function drawSpace(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
): void {
  ctx.fillStyle = PALETTE.space
  ctx.fillRect(0, 0, viewW, viewH)
  const layer = starfieldLayer(viewW, viewH)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(layer.canvas, 0, 0, viewW, viewH)
  ctx.imageSmoothingEnabled = true
}

/** Swirling cosmic fluid inside the playable disk. Arena space (origin at center). */
export function drawOcean(
  ctx: CanvasRenderingContext2D,
  R: number,
  RCore: number,
  t: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.clip()

  const fill = ctx.createRadialGradient(0, 0, RCore, 0, 0, R)
  fill.addColorStop(0, PALETTE.oceanInner)
  fill.addColorStop(0.45, PALETTE.oceanMid)
  fill.addColorStop(1, PALETTE.oceanEdge)
  ctx.fillStyle = fill
  ctx.fillRect(-R, -R, R * 2, R * 2)

  const neb = nebulaLayer(R)
  ctx.save()
  ctx.rotate(t * 0.012)
  ctx.globalAlpha = 0.72
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(neb.canvas, -R, -R, R * 2, R * 2)
  ctx.restore()

  ctx.save()
  ctx.rotate(-t * 0.007)
  ctx.globalAlpha = 0.28
  ctx.imageSmoothingEnabled = false
  ctx.scale(-1, 1)
  ctx.drawImage(neb.canvas, -R, -R, R * 2, R * 2)
  ctx.restore()

  drawCurrents(ctx, R, RCore, t)

  ctx.restore()
}

function drawCurrents(
  ctx: CanvasRenderingContext2D,
  R: number,
  RCore: number,
  t: number,
): void {
  ctx.lineCap = 'butt'
  ctx.setLineDash([7, 22])
  for (let i = 1; i <= 3; i++) {
    const u = i / 4
    const r = RCore + ((R - RCore) * i) / 4
    // Faster angular flow near the center — matches θ̇ = speed / r.
    ctx.lineDashOffset = -t * lerp(52, 16, u)
    ctx.strokeStyle = i === 1 ? PALETTE.currentInner : PALETTE.current
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
}

/** Procedural gravity vortex. Visual only — death radius stays RCore. */
export function drawVortex(
  ctx: CanvasRenderingContext2D,
  RCore: number,
  t: number,
  /** 0–1 swallow intensity — brightens / tightens the hole while feeding. */
  feed = 0,
  /** 0–1 worm proximity — hole swells slightly when the worm is near. */
  near = 0,
): void {
  const disc = vortexDiscLayer(RCore)
  const size = RCore * 3.2
  ctx.drawImage(disc.canvas, -size * 0.5, -size * 0.5, size, size)

  const spirals = spiralArmsLayer(RCore)
  const spin = RCore * 3
  const feedEase = feed * feed
  ctx.save()
  ctx.rotate(t * 0.42)
  ctx.drawImage(spirals.canvas, -spin * 0.5, -spin * 0.5, spin, spin)
  ctx.restore()
  ctx.save()
  ctx.rotate(-t * 0.2)
  ctx.globalAlpha = 0.55 + feedEase * 0.35
  ctx.scale(1.06, 1.06)
  ctx.drawImage(spirals.canvas, -spin * 0.5, -spin * 0.5, spin, spin)
  ctx.restore()
  ctx.globalAlpha = 1

  ctx.save()
  ctx.rotate(t * 0.55)
  ctx.strokeStyle = `rgba(220, 200, 255, ${0.32 + feedEase * 0.35})`
  ctx.lineWidth = 2 + feedEase
  ctx.beginPath()
  ctx.ellipse(0, 0, RCore * 0.98, RCore * 0.34, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(90, 160, 255, ${0.4 + feedEase * 0.3})`
  ctx.lineWidth = 1.7 + feedEase * 0.8
  ctx.beginPath()
  ctx.ellipse(0, 0, RCore * 1.12, RCore * 0.42, 0.7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  drawVortexParticles(ctx, RCore, t)

  drawVortexCore(ctx, RCore, feedEase, near)

  // Exact collision radius — thin, readable, independent of bloom.
  ctx.strokeStyle = 'rgba(180, 160, 255, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, RCore, 0, Math.PI * 2)
  ctx.stroke()
}

/** Black core + optional accretion flash. Drawn again over the worm while swallowing. */
export function drawVortexCore(
  ctx: CanvasRenderingContext2D,
  RCore: number,
  feed = 0,
  /** 0–1 worm proximity — swells only the dark core. */
  near = 0,
): void {
  const feedEase = feed * feed
  // Ease-in swell so it reads late (max ~65%).
  const swell = 1 + near * near * 0.65
  const coreR = RCore * (0.48 + feedEase * 0.50) * swell
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR)
  core.addColorStop(0, '#000000')
  core.addColorStop(0.7, PALETTE.vortexCore)
  core.addColorStop(1, 'rgba(20, 10, 40, 0.15)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, coreR, 0, Math.PI * 2)
  ctx.fill()

  if (feedEase > 0.05) {
    const flash = ctx.createRadialGradient(0, 0, coreR * 0.6, 0, 0, RCore * 1.4)
    flash.addColorStop(0, `rgba(200, 170, 255, ${0.12 * feedEase})`)
    flash.addColorStop(0.55, `rgba(90, 140, 255, ${0.18 * feedEase})`)
    flash.addColorStop(1, 'rgba(40, 60, 140, 0)')
    ctx.fillStyle = flash
    ctx.beginPath()
    ctx.arc(0, 0, RCore * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSpiralArms(
  ctx: CanvasRenderingContext2D,
  r0: number,
  r1: number,
  t: number,
): void {
  const arms = 3
  const steps = 24
  ctx.lineCap = 'round'
  for (let arm = 0; arm < arms; arm++) {
    const base = (arm / arms) * Math.PI * 2 + t * 0.8
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const ang = base + u * 3.4
      const r = lerp(r0, r1, u)
      const x = Math.cos(ang) * r
      const y = Math.sin(ang) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle =
      arm === 0 ? 'rgba(200, 175, 255, 0.4)' : 'rgba(80, 140, 255, 0.5)'
    ctx.lineWidth = lerp(3.4, 1.1, arm / arms)
    ctx.stroke()
  }
}

function drawVortexParticles(
  ctx: CanvasRenderingContext2D,
  RCore: number,
  t: number,
): void {
  const dust = 20
  for (let i = 0; i < dust; i++) {
    const u = (hash01(i * 6.1) + t * lerp(0.08, 0.18, hash01(i + 3))) % 1
    const r = lerp(RCore * 1.55, RCore * 0.52, u)
    const ang =
      hash01(i * 17.7) * Math.PI * 2 + t * lerp(0.7, 2.1, hash01(i * 2 + 1))
    const x = Math.cos(ang) * r
    const y = Math.sin(ang) * r
    const hot = hash01(i + 0.4) > 0.7
    ctx.fillStyle = hot ? PALETTE.vortexHot : PALETTE.star
    ctx.globalAlpha = 0.4 + (1 - u) * 0.55
    const s = hot ? 2.5 : 1.75
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s)
  }

  const streaks = 4
  ctx.lineCap = 'round'
  for (let i = 0; i < streaks; i++) {
    const u = (hash01(i * 21.4 + 2) + t * lerp(0.22, 0.4, hash01(i))) % 1
    const r = lerp(RCore * 1.35, RCore * 0.6, u)
    const ang = hash01(i * 8.8) * Math.PI * 2 + t * lerp(1.6, 3.2, hash01(i + 5))
    const x = Math.cos(ang) * r
    const y = Math.sin(ang) * r
    const tx = -Math.sin(ang)
    const ty = Math.cos(ang)
    const len = lerp(5, 11, hash01(i * 3))
    ctx.globalAlpha = 0.35 + (1 - u) * 0.3
    ctx.strokeStyle = i % 2 === 0 ? PALETTE.vortexHot : PALETTE.vortexBlue
    ctx.lineWidth = 1.35
    ctx.beginPath()
    ctx.moveTo(x - tx * len, y - ty * len)
    ctx.lineTo(x + tx * len * 0.2, y + ty * len * 0.2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/**
 * 0 at a safe radius, 1 when the head is on the lethal wall.
 * Collision math is unchanged — this is only for warning juice.
 */
export function wallDanger(
  r: number,
  R: number,
  halfThickness: number,
): number {
  const headR = r + halfThickness
  const start = R * 0.8
  return clamp((headR - start) / Math.max(1, R - start), 0, 1)
}

/**
 * 0 far from the hole, 1 when the orbit radius is on the lethal core.
 * Visual only — death radius stays RCore.
 */
export function coreProximity(r: number, RCore: number): number {
  const start = RCore * 2.4
  return clamp((start - r) / Math.max(1, start - RCore), 0, 1)
}

export function voidShake(
  t: number,
  danger: number,
): { x: number; y: number } {
  if (danger <= 0) return { x: 0, y: 0 }
  const m = danger * danger * 1.7
  return {
    x: Math.sin(t * 43.2) * m,
    y: Math.cos(t * 36.1) * m,
  }
}

/** Cosmic-ocean shoreline. Crisp stroke at R, glow/energy outside it. */
export function drawVoidBoundary(
  ctx: CanvasRenderingContext2D,
  R: number,
  t: number,
  danger: number,
): void {
  const glow = 0.28 + danger * 0.5
  ctx.beginPath()
  ctx.arc(0, 0, R + 10 + danger * 8, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(80, 50, 160, ${0.12 + danger * 0.22})`
  ctx.lineWidth = 18 + danger * 10
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, R + 3, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(138, 109, 255, ${glow})`
  ctx.lineWidth = 4 + danger * 3
  ctx.stroke()

  // Exact collision radius.
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.strokeStyle =
    danger > 0.55
      ? `rgba(220, 200, 255, ${0.55 + danger * 0.4})`
      : PALETTE.voidRim
  ctx.lineWidth = 1.5
  ctx.stroke()

  const sparks = 20
  for (let i = 0; i < sparks; i++) {
    const jitter = (hash01(i * 3 + t * 9) - 0.5) * (2 + danger * 10)
    const a =
      hash01(i * 14.2) * Math.PI * 2 + t * (0.08 + danger * 0.35) + jitter * 0.01
    const out = (hash01(i * 5.5) - 0.25) * (5 + danger * 14)
    const x = Math.cos(a) * (R + out)
    const y = Math.sin(a) * (R + out)
    ctx.globalAlpha = 0.2 + danger * 0.55 + hash01(i + t) * 0.2
    ctx.fillStyle = hash01(i) > 0.7 ? PALETTE.voidHot : PALETTE.star
    const s = 1 + (hash01(i * 2) > 0.8 ? 1 : 0) + (danger > 0.7 ? 1 : 0)
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s)
  }
  ctx.globalAlpha = 1
}
