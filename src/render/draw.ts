import rockUrl from '../../assets/images/rock.png'
import { tunablesForRadius } from '../core/config'
import type { World } from '../core/types'
import { headPos } from '../core/worm'
import {
  drawFx,
  fxActive,
  shakeOffset,
  wormFlashOn,
  type FxState,
} from '../fx/effects'

export const COLORS = {
  background: '#0B1020',
  arenaFill: '#121A33',
  arenaStroke: '#3A4A6A',
  guide: 'rgba(58, 74, 106, 0.35)',
  wormFill: '#FF7A18',
  wormOutline: '#C45A10',
  wormFlash: '#FFF3E0',
  appleRed: '#E23B3B',
  appleGreen: '#3CB86A',
  appleStem: '#5C3B1E',
  appleLeaf: '#2E8B4F',
  rock: '#8B5A2B',
  rockOutline: '#5C3B1E',
  rockShade: '#6E4520',
  eye: '#0B1020',
  eyeHighlight: '#FFFFFF',
} as const

/** Crisp 64×64 pixel rock; drawn when decode completes. */
const rockSprite = new Image()
rockSprite.decoding = 'async'
rockSprite.src = rockUrl

function rockSpriteReady(): boolean {
  return rockSprite.complete && rockSprite.naturalWidth > 0
}

export type DrawOpts = {
  /** 0–1 darken over the frame (title screen). Drawn on canvas, not CSS. */
  dim?: number
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  viewW: number,
  viewH: number,
  fx?: FxState,
  opts?: DrawOpts,
): void {
  const cx = viewW * 0.5
  const cy = viewH * 0.5
  const tunables = tunablesForRadius(world.R)
  const shake = fx ? shakeOffset(fx) : { x: 0, y: 0 }

  // Single opaque clear — avoid a second full-frame gradient fill (very costly).
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, viewW, viewH)

  ctx.save()
  ctx.translate(cx + shake.x, cy + shake.y)

  ctx.beginPath()
  ctx.arc(0, 0, world.R, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.arenaFill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COLORS.arenaStroke
  ctx.stroke()

  ctx.strokeStyle = COLORS.guide
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const r = world.RCore + ((world.R - world.RCore) * i) / 4
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  drawRock(ctx, 0, 0, world.RCore, 0)

  for (const rock of world.rocks) {
    drawRock(ctx, rock.x, rock.y, rock.radius, rock.id)
  }

  if (world.apple) {
    drawApple(
      ctx,
      world.apple.x,
      world.apple.y,
      world.apple.radius,
      world.apple.color,
    )
  }

  const flash = fx ? wormFlashOn(fx) : false
  drawWorm(ctx, world, tunables.wormThickness, flash)

  if (fx && fxActive(fx)) drawFx(ctx, fx)

  ctx.restore()

  const dim = opts?.dim ?? 0
  if (dim > 0) {
    ctx.fillStyle = `rgba(11, 16, 32, ${dim})`
    ctx.fillRect(0, 0, viewW, viewH)
  }
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  id: number,
): void {
  if (rockSpriteReady()) {
    const size = radius * 2
    // Sit “upright” vs center gravity: sprite top points outward.
    const angle =
      x === 0 && y === 0 ? 0 : Math.atan2(y, x) + Math.PI * 0.5
    ctx.save()
    ctx.translate(x, y)
    if (angle !== 0) ctx.rotate(angle)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(rockSprite, -size * 0.5, -size * 0.5, size, size)
    ctx.restore()
    return
  }

  // Fallback before the sprite finishes loading.
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.rock
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COLORS.rockOutline
  ctx.stroke()

  const a = Math.sin(id * 12.9898) * 43758.5453
  const b = Math.sin(id * 78.233) * 43758.5453
  const ox = (a - Math.floor(a) - 0.5) * radius * 0.45
  const oy = (b - Math.floor(b) - 0.5) * radius * 0.45
  ctx.beginPath()
  ctx.arc(x + ox, y + oy, radius * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.rockShade
  ctx.fill()
}

function drawApple(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: 'red' | 'green',
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color === 'red' ? COLORS.appleRed : COLORS.appleGreen
  ctx.fill()

  ctx.strokeStyle = COLORS.appleStem
  ctx.lineWidth = Math.max(1.5, radius * 0.2)
  ctx.beginPath()
  ctx.moveTo(x, y - radius * 0.7)
  ctx.lineTo(x, y - radius * 1.25)
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(
    x + radius * 0.35,
    y - radius * 1.1,
    radius * 0.35,
    radius * 0.2,
    -0.4,
    0,
    Math.PI * 2,
  )
  ctx.fillStyle = COLORS.appleLeaf
  ctx.fill()
}

function drawWorm(
  ctx: CanvasRenderingContext2D,
  world: World,
  thickness: number,
  flash = false,
): void {
  const deposited = world.worm.points
  if (deposited.length === 0) return

  const fill = flash ? COLORS.wormFlash : COLORS.wormFill
  const outline = flash ? '#FFFFFF' : COLORS.wormOutline
  const head = headPos(world.worm)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Contiguous worm: outline then fill. Avoid allocating a merged polyline each frame.
  strokeWormPath(ctx, head, deposited, thickness + 4, outline)
  strokeWormPath(ctx, head, deposited, thickness, fill)

  ctx.beginPath()
  ctx.arc(head.x, head.y, thickness * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = outline
  ctx.stroke()

  let tx = Math.cos(world.worm.theta)
  let ty = Math.sin(world.worm.theta)
  const newest = deposited[deposited.length - 1]!
  const dx = head.x - newest.x
  const dy = head.y - newest.y
  const len = Math.hypot(dx, dy)
  if (len > 0.05) {
    tx = dx / len
    ty = dy / len
  } else if (deposited.length > 1) {
    const prev = deposited[deposited.length - 2]!
    const dx2 = head.x - prev.x
    const dy2 = head.y - prev.y
    const len2 = Math.hypot(dx2, dy2) || 1
    tx = dx2 / len2
    ty = dy2 / len2
  }
  const nx = -ty
  const ny = tx
  const eyeDist = thickness * 0.28
  const eyeForward = thickness * 0.2
  drawEye(
    ctx,
    head.x + tx * eyeForward + nx * eyeDist,
    head.y + ty * eyeForward + ny * eyeDist,
    thickness * 0.12,
  )
  drawEye(
    ctx,
    head.x + tx * eyeForward - nx * eyeDist,
    head.y + ty * eyeForward - ny * eyeDist,
    thickness * 0.12,
  )
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

  // Draw oldest → newest → live head.
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

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.eye
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.eyeHighlight
  ctx.fill()
}
