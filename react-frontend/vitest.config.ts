import { defineConfig, mergeConfig } from 'vitest/config'
import { resolve } from 'node:path'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary'],
        include: [
          'src/pages/Invoices.tsx',
          'src/pages/OrderDetail.tsx',
          'src/pages/clients/ClientCommercialContent.tsx',
        ],
        // BDC-63 : seuils bloquants (lignes / branches / statements) ; `functions` reste bas (BDC-41, gros écrans CRM)
        thresholds: {
          lines: 40,
          functions: 10,
          branches: 35,
          statements: 40,
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }),
)
