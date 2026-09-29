import { describe, expect, it } from 'vitest'
import {
  buildBattleShareText,
  buildShareText,
} from '../../src/platform/shareScore'
import {
  ACHIEVEMENT_SCORE_GATES,
  GAME_CENTER,
} from '../../src/platform/gameCenterConfig'

describe('shareScore copy', () => {
  it('includes score and web URL', () => {
    const text = buildShareText(18420)
    expect(text).toContain('18,420')
    expect(text).toContain('Wormular')
    expect(text).toContain('https://lwilli.github.io/wormular/')
  })

  it('formats battle results', () => {
    const text = buildBattleShareText('Orange wins!', '3 – 1')
    expect(text).toContain('Orange wins!')
    expect(text).toContain('3 – 1')
    expect(text).toContain('https://lwilli.github.io/wormular/')
  })
})

describe('Game Center config', () => {
  it('uses stable leaderboard and achievement ids', () => {
    expect(GAME_CENTER.leaderboardId).toBe('wormular.highscore')
    expect(Object.values(GAME_CENTER.achievements)).toEqual([
      'wormular.achievement.first_worm',
      'wormular.achievement.score_1000',
      'wormular.achievement.score_10000',
      'wormular.achievement.score_50000',
      'wormular.achievement.score_100000',
    ])
    expect(ACHIEVEMENT_SCORE_GATES.map((g) => g.score)).toEqual([
      1, 1000, 10000, 50000, 100000,
    ])
  })
})
