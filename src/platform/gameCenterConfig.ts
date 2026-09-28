/**
 * App Store Connect identifiers — configure in ASC before shipping.
 * Keep IDs stable; do not scatter string literals through gameplay code.
 */
export const GAME_CENTER = {
  /** All-time high score leaderboard. */
  leaderboardId: 'wormular.highscore',
  achievements: {
    firstWorm: 'wormular.achievement.first_worm',
    score1000: 'wormular.achievement.score_1000',
    score10000: 'wormular.achievement.score_10000',
    score50000: 'wormular.achievement.score_50000',
    score100000: 'wormular.achievement.score_100000',
  },
} as const

export type AchievementKey = keyof typeof GAME_CENTER.achievements

/** Score thresholds → achievement keys (checked after a solo run). */
export const ACHIEVEMENT_SCORE_GATES: { score: number; key: AchievementKey }[] = [
  { score: 1, key: 'firstWorm' },
  { score: 1000, key: 'score1000' },
  { score: 10000, key: 'score10000' },
  { score: 50000, key: 'score50000' },
  { score: 100000, key: 'score100000' },
]
