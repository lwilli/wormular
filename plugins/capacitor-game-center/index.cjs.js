'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const core = require('@capacitor/core')
const GameCenter = core.registerPlugin('GameCenter', {
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
exports.GameCenter = GameCenter
