import { tunablesForRadius } from '../core/config'
import type { BattleWorld, World } from '../core/types'
import {
  drawFx,
  eatGlowProgress,
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
import { drawHazards, drawStarFruit, drawWorm, syncSpawnPops, type WormStyle } from './entities'
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
  const near = coreProximity(world.worm.r, world.RCore)
  const shake = fx ? shakeOffset(fx) : { x: 0, y: 0 }
  const warn = voidShake(t, danger)
  const hole = voidShake(t + 1.7, near)

  drawSpace(ctx, viewW, viewH)

  ctx.save()
  ctx.translate(
    cx + shake.x + warn.x + hole.x,
    cy + shake.y + warn.y + hole.y,
  )

  const suck = fx ? suckProgress(fx) : 0

  drawOcean(ctx, world.R, world.RCore, t)
  drawVortex(ctx, world.RCore, t, suck, near)
  syncSpawnPops(world, t)
  drawHazards(ctx, world.rocks, t)

  if (world.apple) drawStarFruit(ctx, world.apple, t)

  const flash = fx ? wormFlashOn(fx) : false
  const eatGlow = fx ? eatGlowProgress(fx) : null
  drawWorm(ctx, world, tunables.wormThickness, flash, danger, suck, eatGlow)

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


const P0_STYLE: WormStyle = {
  fill: PALETTE.wormFill,
  outline: PALETTE.wormOutline,
  gloss: PALETTE.wormGloss,
  glow: PALETTE.wormFill,
}

const P1_STYLE: WormStyle = {
  fill: PALETTE.worm2Fill,
  outline: PALETTE.worm2Outline,
  gloss: PALETTE.worm2Gloss,
  glow: PALETTE.worm2Fill,
}

/** Draw a 1v1 battle (two worms, up to two apples). */
export function drawBattleWorld(
  ctx: CanvasRenderingContext2D,
  battle: BattleWorld,
  viewW: number,
  viewH: number,
  fx?: FxState,
  opts?: DrawOpts,
): void {
  const shell: World = {
    R: battle.R,
    RCore: battle.RCore,
    worm: battle.players[0].worm,
    rocks: battle.rocks,
    apple: battle.apples[0],
    score: battle.players[0].score,
    speed: battle.players[0].speed,
    alive: battle.players[0].alive,
    events: [],
    nextRockId: battle.nextRockId,
    pointsSinceLastRock: battle.pointsSinceLastRock,
    seed: battle.seed,
  }

  const cx = viewW * 0.5
  const cy = viewH * 0.5
  const tunables = tunablesForRadius(battle.R)
  const t = opts?.time ?? 0
  const danger0 = wallDanger(
    battle.players[0].worm.r,
    battle.R,
    tunables.wormThickness * 0.5,
  )
  const danger1 = wallDanger(
    battle.players[1].worm.r,
    battle.R,
    tunables.wormThickness * 0.5,
  )
  const danger = Math.max(danger0, danger1)
  const near = Math.max(
    coreProximity(battle.players[0].worm.r, battle.RCore),
    coreProximity(battle.players[1].worm.r, battle.RCore),
  )
  const shake = fx ? shakeOffset(fx) : { x: 0, y: 0 }
  const warn = voidShake(t, danger)
  const hole = voidShake(t + 1.7, near)

  drawSpace(ctx, viewW, viewH)
  ctx.save()
  ctx.translate(
    cx + shake.x + warn.x + hole.x,
    cy + shake.y + warn.y + hole.y,
  )

  const suck = fx ? suckProgress(fx) : 0
  drawOcean(ctx, battle.R, battle.RCore, t)
  drawVortex(ctx, battle.RCore, t, suck, near)
  syncSpawnPops(shell, t)
  drawHazards(ctx, battle.rocks, t)

  for (const apple of battle.apples) {
    if (apple) drawStarFruit(ctx, apple, t)
  }

  const flash = fx ? wormFlashOn(fx) : false
  const eatGlow = fx ? eatGlowProgress(fx) : null
  drawWorm(
    ctx,
    shell,
    tunables.wormThickness,
    flash && battle.winner === 1,
    danger0,
    battle.winner === 1 ? suck : 0,
    eatGlow,
    P0_STYLE,
    battle.players[0].worm,
  )
  drawWorm(
    ctx,
    shell,
    tunables.wormThickness,
    flash && battle.winner === 0,
    danger1,
    battle.winner === 0 ? suck : 0,
    null,
    P1_STYLE,
    battle.players[1].worm,
  )

  if (suck > 0.02) drawVortexCore(ctx, battle.RCore, suck, near)
  drawVoidBoundary(ctx, battle.R, t, danger)
  if (fx && fxActive(fx)) drawFx(ctx, fx)
  ctx.restore()

  const dim = opts?.dim ?? 0
  if (dim > 0) {
    ctx.fillStyle = `rgba(5, 6, 14, ${dim})`
    ctx.fillRect(0, 0, viewW, viewH)
  }
}
