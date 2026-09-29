import { registerPlugin } from '@capacitor/core'

const GameCenter = registerPlugin('GameCenter', {
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
      async showDashboard() {},
      async unlockAchievement() {
        return { unlocked: false }
      },
    }),
})

export { GameCenter }
