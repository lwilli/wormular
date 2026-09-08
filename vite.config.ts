/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

// GitHub Pages serves from https://<user>.github.io/wormular/
export default defineConfig({
  base: '/wormular/',
  test: {
    environment: 'node',
  },
})
