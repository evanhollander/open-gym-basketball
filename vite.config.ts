/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo at /open-gym-basketball/, so built asset
// URLs need that base path baked in (see OPEN_GYM_LOGIC.md's port plan,
// Deployment section). Must match the GitHub repo name exactly.
export default defineConfig({
  base: '/open-gym-basketball/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // autoUpdate: the service worker checks for a new build on every
      // load and swaps in fresh files in the background - no manual "hard
      // refresh" needed to pick up a new deploy (we already hit exactly
      // that confusion once with plain browser caching before this existed).
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Open Gym Basketball',
        short_name: 'Open Gym',
        description: 'Fair team rotation for pickup basketball - add players, assign courts, track who sits.',
        theme_color: '#141a26',
        background_color: '#f1e0b4',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is static (no API calls - state lives in
        // localStorage), so precaching the whole build means it keeps
        // working with zero network at all once installed. woff2 is in here
        // because the Oswald/Archivo fonts are self-hosted (@fontsource,
        // see index.css) specifically so they don't depend on a Google
        // Fonts CDN request that would break this offline guarantee.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
