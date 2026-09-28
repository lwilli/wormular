# iOS implementation notes (inspection)

Captured before Milestone 1+ work. Linux CI/cloud agents cannot run Xcode; device/simulator verification is manual on a Mac.

## Architecture map

| Concern | Location |
| --- | --- |
| Entry / loop | `src/main.ts` — modes `title` \| `playing` \| `dying` \| `battle*` \| `matchmaking` \| `result` |
| Simulation | `src/core/*` (pure; no Capacitor) |
| Input | `src/input/hold.ts`, `dualHold.ts` |
| Score | `World.score` / battle player scores; `src/platform/storage.ts` personal best |
| UI | `index.html` + `src/ui/title.ts` + `src/style.css` |
| Audio | `src/platform/audio.ts` — Web Audio SFX, HTMLAudio→WebAudio BGM |
| Networking | `src/platform/leaderboard.ts`, `src/net/*`, Cloudflare Worker |
| Persistence | Capacitor Preferences (native) / `localStorage` (web) |
| Capacitor | `capacitor.config.ts`, `ios/App`, `@capacitor/core` **8.5.1** |

## Capacitor / iOS baseline

- **Plugins installed (pre-change):** `@capacitor/preferences`
- **iOS-specific code:** `GameViewController` (disable text interaction), edge-to-edge `contentInset: never`, safe-area CSS
- **Asset path:** `npm run build:ios` → `dist/` → `npx cap sync ios` → `ios/App/App/public`
- **Bundle id:** `com.lwilli.wormular` · deployment target **iOS 15** · display name **Wormular**
- **No Game Center / Haptics / Share / App lifecycle plugins** yet (added in this work)

## Gaps vs product brief

- No haptics, native share, Game Center, or pause-on-background
- Audio mute flags only in `localStorage` (not Preferences on device)
- Result UI is “Tap to continue” only (no Play Again / Share / Leaderboard actions)
- No first-run guided Solo onboarding
- Orientation allows landscape on iPhone

## Manual (Mac) remaining

Signing, Game Center App Store Connect IDs, TestFlight, physical-device QA.
