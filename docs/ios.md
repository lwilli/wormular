# iOS — run on a real iPhone

Capacitor wraps the web build in Xcode. Simulator is fine for layout; **device** needs a free or paid Apple ID for signing. **Game Center** and TestFlight need a paid Apple Developer Program membership.

## Capacitor stack

- Capacitor **8.5.x** (`@capacitor/core` / `@capacitor/ios`)
- Official plugins: Preferences, Haptics, Share, App
- Local plugin: `plugins/capacitor-game-center` (GameKit bridge)
- Bundle id: `com.lwilli.wormular` · display name **Wormular** · iOS **15+**
- Portrait-only on iPhone; status bar hidden; edge-to-edge WKWebView (`contentInset: never`)
- Production assets: `npm run build:ios` → `dist/` → `npx cap sync ios` (no Vite dev server in the app)

Architecture notes from the iOS pass: [ios-implementation-notes.md](ios-implementation-notes.md).

## One-time setup

1. **Xcode** with the matching iOS platform (Settings → Platforms / Components).
2. Sign in: Xcode → Settings → Accounts → **Apple ID** (free account is enough for personal devices; Game Center / TestFlight need a paid team).
3. Connect the iPhone with USB (or set up wireless debugging after the first USB pair).
4. On the phone: unlock, trust the computer if prompted.
5. **Developer Mode** (iOS 16+): Settings → Privacy & Security → Developer Mode → On, then reboot if asked.

## Build and run

```bash
npm install
npm run ios          # sync web assets + open Xcode
```

In Xcode (`ios/App/App.xcodeproj`):

1. Select the **App** target → **Signing & Capabilities**.
2. Enable **Automatically manage signing**. Xcode keeps certs and provisioning profiles on the machine — `.p12` / `.p8` keys and `.mobileprovision` files are gitignored.
3. Confirm **Game Center** capability is present (entitlement `App/App.entitlements`).
4. Choose your **Team** (your personal Apple ID team).
5. Keep bundle id `com.lwilli.wormular` unless it collides — then change it to something unique (e.g. `com.yourname.wormular`).
6. In the scheme toolbar, pick your **physical iPhone** (not a simulator).
7. Press **Run** (▶).

First launch on device: if iOS blocks the app, open **Settings → General → VPN & Device Management** (or **Device Management**), trust your developer certificate, then open Wormular again.

## After game/code changes

```bash
npm run cap:sync     # rebuild web (capacitor mode) + copy into ios/
```

Then Run again in Xcode (or `npx cap run ios --target <device>` if you prefer CLI).

## Common issues

| Symptom | Fix |
| --- | --- |
| No Team / signing errors | Add Apple ID under Xcode → Settings → Accounts; pick Team on the App target. |
| Bundle id unavailable | Change `PRODUCT_BUNDLE_IDENTIFIER` in the App target (and match `appId` in `capacitor.config.ts` if you want them aligned). |
| Untrusted developer | Trust the cert on the phone (Settings → General → VPN & Device Management). |
| Blank / old web UI | Run `npm run cap:sync` before Run — `ios/App/App/public` is generated, not hand-edited. |
| Cable not seeing phone | Unlock phone, trust Mac; try another cable; enable Developer Mode. |
| Mode peeks drift off their rings after reopen / keyboard | Canvas must size to the `#app` layout box (not `visualViewport`); resume remounts via `visibilitychange` / `pageshow` + a short settle resize in `src/main.ts`. |
| Game Center auth never succeeds | Paid Developer Program + App Store Connect Game Center enabled for the app id; create leaderboard/achievements matching `src/platform/gameCenterConfig.ts`. |

## App icon

The App Icon is the title-art **W** on `#05060E`, in `App/Assets.xcassets/AppIcon.appiconset/`. After editing `assets/images/wormular-source.png`, regenerate with `npm run icons` — full steps in **[icons.md](icons.md)**.

## Game Center (manual App Store Connect)

IDs are configurable in `src/platform/gameCenterConfig.ts` (defaults below). Create matching records in App Store Connect → your app → Game Center:

| Type | Default ID | Notes |
| --- | --- | --- |
| Leaderboard | `wormular.highscore` | “Wormular — All-Time High Score”, score format Integer, best score |
| Achievement | `wormular.achievement.first_worm` | First Worm (score ≥ 1) |
| Achievement | `wormular.achievement.score_1000` | Score 1,000 |
| Achievement | `wormular.achievement.score_10000` | Score 10,000 |
| Achievement | `wormular.achievement.score_50000` | Score 50,000 |
| Achievement | `wormular.achievement.score_100000` | Score 100,000 |

Auth and score submit are **optional** — the game always plays offline. The existing Wormular backend leaderboard is unchanged and runs in parallel.

## Native share

Solo game-over → **Share** uses Capacitor Share (or Web Share on supporting browsers). Copy includes score + `https://lwilli.github.io/wormular/`. Set `WORMULAR_APP_STORE_URL` in `src/platform/shareScore.ts` once the App Store listing exists.

## Privacy / App Store checklist (owners)

Engineering prepared:

- `PrivacyInfo.xcprivacy` (no tracking / no privacy-accessed APIs declared)
- `ITSAppUsesNonExemptEncryption` = false (HTTPS only — confirm with counsel if needed)
- Cookieless first-party visit/play counters already documented in ADR 0003

Still product/owner decisions before submission:

- Privacy policy URL (required if any data leaves the device — leaderboard + visit counters do)
- App Privacy questionnaire answers (must match real practice; do not invent)
- Age rating questionnaire
- Screenshots / preview video
- TestFlight external group + review notes

## TestFlight

Paid Apple Developer Program required. After ASC app record + Game Center config:

1. Archive in Xcode (Any iOS Device) → Distribute → App Store Connect.
2. Wait for processing → enable TestFlight internal, then external as needed.
3. Smoke-test: clean install, offline solo, settings, haptics, audio interrupt, background pause, Game Center signed-in and signed-out.
