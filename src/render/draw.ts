import { tunablesForRadius } from '../core/config'
import type { World } from '../core/types'
import {
  drawFx,
  fxActive,
  shakeOffset,
  suckProgress,
  wormFlashOn,
  type FxState,
} from '../fx/effects'
import {
  coreProximity,
  drawOcean,
  drawSpace,
  drawVoidBoundary,
  drawVortex,
  drawVortexCore,
  voidShake,
  wallDanger,
} from './cosmic'
import { drawHazards, drawStarFruit, drawWorm, syncSpawnPops } from './entities'
import { PALETTE } from './palette'

export const COLORS = {
  background: PALETTE.space,
  wormFill: PALETTE.wormFill,
  wormOutline: PALETTE.wormOutline,
  wormFlash: PALETTE.wormFlash,
} as const

export type DrawOpts = {
  /** 0–1 darken over the frame (title screen). Drawn on canvas, not CSS. */
  dim?: number
  /** Seconds. Drives vortex, currents, pulses. */
  time?: number
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
  const t = opts?.time ?? 0
  const danger = wallDanger(
    world.worm.r,
    world.R,
    tunables.wormThickness * 0.5,
  )
  const shake = fx ? shakeOffset(fx) : { x: 0, y: 0 }
  const warn = voidShake(t, danger)

  drawSpace(ctx, viewW, viewH)

  ctx.save()
  ctx.translate(cx + shake.x + warn.x, cy + shake.y + warn.y)

  const suck = fx ? suckProgress(fx) : 0
  const near = coreProximity(world.worm.r, world.RCore)

  drawOcean(ctx, world.R, world.RCore, t)
  drawVortex(ctx, world.RCore, t, suck, near)
  syncSpawnPops(world, t)
  drawHazards(ctx, world.rocks, t)

  if (world.apple) drawStarFruit(ctx, world.apple, t)

  const flash = fx ? wormFlashOn(fx) : false
  drawWorm(ctx, world, tunables.wormThickness, flash, danger, suck)

  // Occlude the swallowed tip under the event horizon.
  if (suck > 0.02) drawVortexCore(ctx, world.RCore, suck, near)

  drawVoidBoundary(ctx, world.R, t, danger)

  if (fx && fxActive(fx)) drawFx(ctx, fx)

  ctx.restore()

  const dim = opts?.dim ?? 0
  if (dim > 0) {
    ctx.fillStyle = `rgba(5, 6, 14, ${dim})`
    ctx.fillRect(0, 0, viewW, viewH)
  }
}
