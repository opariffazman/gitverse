import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
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
