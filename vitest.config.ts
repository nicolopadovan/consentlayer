import path from 'node:path'
import { defineConfig } from 'vitest/config'

const src = path.resolve(import.meta.dirname, 'packages/consentlayer/src')

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      { find: /^consentlayer\/(.+)$/, replacement: `${src}/$1` },
      { find: /^consentlayer$/, replacement: `${src}/index.ts` },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
  },
})
