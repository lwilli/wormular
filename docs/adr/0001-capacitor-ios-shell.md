# ADR 0001 — Capacitor iOS shell

## Status

Accepted (phase 5)

## Context

Wormular’s game is a TypeScript + Canvas Vite app. We need a native iPhone build without rewriting the simulation or renderer.

## Decision

Ship iOS as a thin [Capacitor](https://capacitorjs.com/) WKWebView shell around the same web build.

- **Bundle id:** `com.lwilli.wormular`
- **Web assets:** Vite `dist/` via `webDir`; native builds use `vite build --mode capacitor` (`base: '/'`). GitHub Pages keeps `base: '/wormular/'`.
- **Layout:** `ios.contentInset: 'never'` so the arena is edge-to-edge and centered; UI uses `env(safe-area-inset-*)`.
- **Storage:** Capacitor Preferences on native; `localStorage` on web.
- **SFX:** Web Audio `AudioBuffer` (low latency); BGM stays on `HTMLAudioElement`.
- **Scripts:** `npm run ios` / `cap:sync` / `cap:open` (see [ios.md](../ios.md)).

## Consequences

- One codebase for web + iPhone; Android can reuse the same shell later.
- Device runs require Xcode signing (Apple ID); App Store / TestFlight remain phase 8.
- tvOS stays a separate later track (WKWebView shell or Swift port of `src/core`).
