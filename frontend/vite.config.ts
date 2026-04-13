import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Plugin to serve /landing/ as /landing/index.html (dev only)
function landingPagePlugin(): Plugin {
  return {
    name: 'landing-page-plugin',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Rewrite /landing/ to /landing/index.html
        if (req.url === '/landing/' || req.url === '/landing') {
          req.url = '/landing/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    landingPagePlugin(),
    react(),
    TanStackRouterVite(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
      manifest: false, // Use existing public/manifest.json
      workbox: {
        // Cache ONLY the app shell and static assets, nothing else
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Increase limit for large bundles (Yoopta editor + Excalidraw are heavy)
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20 MB
        // Runtime caching for dynamic assets
        runtimeCaching: [
          {
            // Cache PocketBase file uploads (covers, icons, etc.)
            urlPattern: /\/api\/files\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pb-files-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Exclude specific paths from navigation fallback
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/health/,
          /^\/landing/,
          /^\/manifest\.json$/,
          /^\/favicon\.ico$/,
          /^\/sw\.js$/,
          /^\/registerSW\.js$/,
          /^\/_\//,
        ],
      },
      devOptions: {
        enabled: false, // Disable in dev to avoid confusion
      },
    }),
  ],
  resolve: {
    alias: {
      'onnxruntime-web': path.resolve(__dirname, './node_modules/onnxruntime-web/dist/ort.min.mjs'),
      '@': path.resolve(__dirname, './src'),
      '@frameer': path.resolve(__dirname, './frameer/src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy vendor libs – split so they cache independently
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
          'vendor-router': ['@tanstack/react-router'],
          'vendor-excalidraw': ['@excalidraw/excalidraw'],
          'vendor-yoopta': [
            '@yoopta/editor', '@yoopta/paragraph', '@yoopta/headings',
            '@yoopta/lists', '@yoopta/blockquote', '@yoopta/callout',
            '@yoopta/divider', '@yoopta/marks',
            '@yoopta/tabs', '@yoopta/link', '@yoopta/ui',
          ],
          'vendor-slate': ['slate', 'slate-dom', 'slate-react'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-dayjs': ['dayjs'],
          'vendor-dexie': ['dexie'],
          'vendor-pocketbase': ['pocketbase'],
          'vendor-zustand': ['zustand'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
  // Worker configuration for Whisper transcription
  worker: {
    format: 'es',
  },
  // Optimize deps for @huggingface/transformers in workers
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
    exclude: ['@huggingface/transformers'],
  },
});
