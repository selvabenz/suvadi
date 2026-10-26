import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages serves a project site under /<repo>/: the deploy workflow sets
// BASE_PATH=/suvadi/. A root domain needs no BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

// The translation precached for offline reading on the first visit. Any other
// translation in data/translations.json is cached the first time it is read.
// Keep in step with DEFAULT_TRANSLATION in src/lib/data.ts.
const defaultTranslation = process.env.DEFAULT_TRANSLATION ?? 'ta-irv';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Suvadi — சுவடி',
        short_name: 'Suvadi',
        description: 'The Bible in Indian languages, one verse at a time. Works offline.',
        lang: 'ta',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f9f9fb',
        theme_color: '#f9f9fb',
        categories: ['books', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The default translation's whole text (66 book files + manifest) is
        // precached so the app reads offline after one visit. Other translations,
        // cross-references and original-language words are cached the first
        // time they are loaded.
        globPatterns: [
          '**/*.{js,css,html,woff2,png,svg}',
          'data/translations.json',
          `data/${defaultTranslation}/manifest.json`,
          `data/${defaultTranslation}/books/*.json`,
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // shared study data and the ULT word alignment: cached the first time each file is read
            urlPattern: ({ url }) => /\/data\/(?:xrefs|words|tn|twl|tw|ta)\/|\/data\/[^/]+\/align\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'study-data',
              expiration: { maxEntries: 8000, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/data\/[^/]+\/(manifest\.json|books\/[^/]+\.json)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'translations',
              expiration: { maxEntries: 700, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
