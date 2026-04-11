import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

/**
 * SHA court affiché dans le footer. Ordre : CI GitHub, variable injectée par deploy-server.sh,
 * puis git à la racine du dépôt (pas react-frontend seul — évite « local » si .git est seulement à la racine).
 */
function buildGitShortSha(): string {
  const gh = process.env.GITHUB_SHA
  if (typeof gh === 'string' && gh.length >= 7) {
    return gh.slice(0, 7)
  }
  const injected = process.env.GIT_COMMIT_SHORT ?? process.env.VITE_GIT_COMMIT_SHORT
  if (typeof injected === 'string' && /^[a-f0-9]{7,40}$/i.test(injected.trim())) {
    return injected.trim().slice(0, 7)
  }
  const repoRoot = resolve(__dirname, '..')
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      cwd: repoRoot,
    }).trim()
  } catch {
    return 'dev'
  }
}

const buildTimeIso = new Date().toISOString()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_GIT_SHA__: JSON.stringify(buildGitShortSha()),
    __APP_BUILD_ISO__: JSON.stringify(buildTimeIso),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'Lab BTP — Essais & terrain',
        short_name: 'Lab BTP',
        description: 'Plateforme essais laboratoire BTP, CRM et terrain.',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        lang: 'fr',
        start_url: '/',
        scope: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 80, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/sanctum': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
