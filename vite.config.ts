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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}))
