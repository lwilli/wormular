# iOS — run on a real iPhone

Capacitor wraps the web build in Xcode. Simulator is fine for layout; **device** needs a free or paid Apple ID for signing.

## One-time setup

1. **Xcode** with the matching iOS platform (Settings → Platforms / Components).
2. Sign in: Xcode → Settings → Accounts → **Apple ID** (free account is enough for personal devices).
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
2. Enable **Automatically manage signing**.
3. Choose your **Team** (your personal Apple ID team).
4. Keep bundle id `com.lwilli.wormular` unless it collides — then change it to something unique (e.g. `com.yourname.wormular`).
5. In the scheme toolbar, pick your **physical iPhone** (not a simulator).
6. Press **Run** (▶).

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

## Not yet (plan phase 8)

TestFlight, App Store icons/screenshots, and paid Developer Program distribution. For local QA, USB + personal team signing is enough.
