/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves this repo at /open-gym-basketball/, so built asset
// URLs need that base path baked in (see OPEN_GYM_LOGIC.md's port plan,
// Deployment section). Must match the GitHub repo name exactly.
export default defineConfig({
  base: '/open-gym-basketball/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
