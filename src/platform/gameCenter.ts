import { isNativePlatform } from './kv'
import {
  ACHIEVEMENT_SCORE_GATES,
  GAME_CENTER,
  type AchievementKey,
} from './gameCenterConfig'
import { GameCenter } from './gameCenterPlugin'

let authenticated = false
let playerName = ''
let initStarted = false

export function isGameCenterAuthenticated(): boolean {
  return authenticated
}

export function getGameCenterPlayerName(): string {
  return playerName
}

/**
 * Non-blocking Game Center auth. Safe to call on every cold start.
 * Never throws; gameplay continues whether GC is available or not.
 */
export function initGameCenter(): void {
  if (!isNativePlatform() || initStarted) return
  initStarted = true
  void GameCenter.initialize()
    .then((res) => {
      authenticated = !!res.authenticated
      playerName = res.playerName ?? ''
    })
    .catch(() => {
      authenticated = false
    })
}

export async function refreshGameCenterAuth(): Promise<boolean> {
  if (!isNativePlatform()) return false
  try {
    const res = await GameCenter.isAuthenticated()
    authenticated = !!res.authenticated
    return authenticated
  } catch {
    authenticated = false
    return false
  }
}

/** Submit all-time high score. Soft-fail. */
export function submitGameCenterScore(score: number): void {
  if (!isNativePlatform() || score <= 0) return
  void GameCenter.submitScore({
    score: Math.floor(score),
    leaderboardId: GAME_CENTER.leaderboardId,
  })
    .then((res) => {
      if (res.submitted) authenticated = true
    })
    .catch(() => {
      /* soft-fail */
    })
}

export function showGameCenterDashboard(): void {
  if (!isNativePlatform()) return
  void GameCenter.showDashboard({
    leaderboardId: GAME_CENTER.leaderboardId,
  }).catch(() => {
    /* soft-fail */
  })
}

export function unlockAchievement(key: AchievementKey): void {
  if (!isNativePlatform()) return
  const id = GAME_CENTER.achievements[key]
  void GameCenter.unlockAchievement({
    achievementId: id,
    percentComplete: 100,
  }).catch(() => {
    /* soft-fail */
  })
}

/** After a solo run, unlock any score-gated achievements the player earned. */
export function reportSoloRunAchievements(score: number): void {
  if (!isNativePlatform() || score <= 0) return
  for (const gate of ACHIEVEMENT_SCORE_GATES) {
    if (score >= gate.score) unlockAchievement(gate.key)
  }
}
