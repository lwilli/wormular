/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

// Local dev at `/`; GitHub Pages at `/wormular/`.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/wormular/' : '/',
  test: {
    environment: 'node',
  },
}))
