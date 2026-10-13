import path from 'node:path'
import { defineConfig } from 'vitest/config'

const src = path.resolve(import.meta.dirname, 'packages/analytics-consent-manager/src')

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      { find: /^@nicolopadovan\/analytics-consent-manager\/(.+)$/, replacement: `${src}/$1` },
      { find: /^@nicolopadovan\/analytics-consent-manager$/, replacement: `${src}/index.ts` },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
  },
})
