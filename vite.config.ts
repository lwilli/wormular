/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

// Local / Capacitor: `/`. GitHub Pages: `/wormular/`.
// Native shell builds with `vite build --mode capacitor`.
export default defineConfig(({ command, mode }) => ({
  base: command === 'build' && mode !== 'capacitor' ? '/wormular/' : '/',
  test: {
    environment: 'node',
  },
  server: {
    // Listen on LAN so a phone on the same Wi‑Fi can hit http://<your-ip>:5173/
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}))
