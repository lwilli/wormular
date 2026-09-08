import { tunablesForRadius } from '../core/config'
import type { World } from '../core/types'
import { bodyPolyline, headPos } from '../core/worm'

export const COLORS = {
  background: '#0B1020',
  arenaFill: '#121A33',
  arenaStroke: '#3A4A6A',
  guide: 'rgba(58, 74, 106, 0.35)',
  wormFill: '#FF7A18',
  wormOutline: '#C45A10',
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

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  viewW: number,
  viewH: number,
): void {
  const cx = viewW * 0.5
  const cy = viewH * 0.5
  const tunables = tunablesForRadius(world.R)

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, viewW, viewH)

  const vig = ctx.createRadialGradient(
    cx,
    cy,
    world.R * 0.2,
    cx,
    cy,
    Math.max(viewW, viewH) * 0.75,
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, viewW, viewH)

  ctx.save()
  ctx.translate(cx, cy)

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

  drawWorm(ctx, world, tunables.wormThickness)

  ctx.restore()
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  id: number,
): void {
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
): void {
  const points = bodyPolyline(world.worm)
  if (points.length === 0) return

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Contiguous worm: outline then fill along the deposited path (samples never slide).
  strokePolyline(ctx, points, thickness + 4, COLORS.wormOutline)
  strokePolyline(ctx, points, thickness, COLORS.wormFill)

  const head = headPos(world.worm)
  ctx.beginPath()
  ctx.arc(head.x, head.y, thickness * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.wormFill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COLORS.wormOutline
  ctx.stroke()

  let tx = Math.cos(world.worm.theta)
  let ty = Math.sin(world.worm.theta)
  if (points.length > 1) {
    const n = points[1]!
    const dx = head.x - n.x
    const dy = head.y - n.y
    const len = Math.hypot(dx, dy) || 1
    tx = dx / len
    ty = dy / len
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

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  color: string,
): void {
  if (points.length < 2) {
    ctx.beginPath()
    ctx.arc(points[0]!.x, points[0]!.y, width * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y)
  }
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
