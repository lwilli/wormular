import { registerPlugin } from '@capacitor/core'

export type GameCenterAuthResult = {
  authenticated: boolean
  playerName?: string
}

export type GameCenterPlugin = {
  initialize: () => Promise<GameCenterAuthResult>
  isAuthenticated: () => Promise<{ authenticated: boolean }>
  submitScore: (opts: {
    score: number
    leaderboardId: string
  }) => Promise<{ submitted: boolean }>
  showDashboard: (opts?: {
    leaderboardId?: string
  }) => Promise<void>
  unlockAchievement: (opts: {
    achievementId: string
    percentComplete?: number
  }) => Promise<{ unlocked: boolean }>
}

/**
 * Native Game Center bridge. Web stub always reports unauthenticated.
 * Failures must never block gameplay — callers soft-catch.
 */
export const GameCenter = registerPlugin<GameCenterPlugin>('GameCenter', {
  web: () =>
    Promise.resolve({
      async initialize() {
        return { authenticated: false }
      },
      async isAuthenticated() {
        return { authenticated: false }
      },
      async submitScore() {
        return { submitted: false }
      },
      async showDashboard() {
        /* no-op */
      },
      async unlockAchievement() {
        return { unlocked: false }
      },
    }),
})
