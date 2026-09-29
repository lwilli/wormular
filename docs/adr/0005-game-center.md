# ADR 0005 — Game Center as optional parallel leaderboard

## Status

Accepted (iOS milestones 3–4)

## Context

Wormular already has a soft-trust Cloudflare Worker leaderboard used by web and iOS. App Store games benefit from Game Center, but requiring Apple identity would break web parity and offline solo play.

## Decision

Ship a **minimal** Capacitor Game Center plugin (`plugins/capacitor-game-center`) that exposes only:

- `initialize` / `isAuthenticated`
- `submitScore` (configurable leaderboard id, default `wormular.highscore`)
- `showDashboard`
- `unlockAchievement` (five score-gated achievements; ids in `src/platform/gameCenterConfig.ts`)

Game Center is **optional**. Failures never block gameplay, local high score, or the Wormular backend leaderboard. Identities are **not** synchronized between systems.

## Consequences

- App Store Connect must create matching leaderboard/achievement IDs before scores appear in production.
- Two independent high-score surfaces until a later identity-linking project (explicitly out of scope).
- Paid Apple Developer Program required for real Game Center auth; Simulator / unsigned builds soft-fail cleanly.
