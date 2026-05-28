import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/gitverse/',
  plugins: [
    UnoCSS(),
    svelte(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Gitverse',
        short_name: 'Gitverse',
        description: 'Realistic browser-based git sandbox with live DAG visualization',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      $engine: '/src/engine',
      $shell: '/src/shell',
      $ui: '/src/ui',
      $graph: '/src/graph',
      $store: '/src/store',
      $persistence: '/src/persistence',
    },
  },
});
