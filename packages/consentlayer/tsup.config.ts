import { readFile, writeFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ecommerce: 'src/ecommerce.ts',
    'react/index': 'src/react/index.ts',
    'providers/meta': 'src/providers/meta.ts',
    'providers/ga4': 'src/providers/ga4.ts',
    'providers/shopify': 'src/providers/shopify.ts',
    'providers/contentsquare': 'src/providers/contentsquare.ts',
    'providers/hotjar': 'src/providers/hotjar.ts',
    'providers/vercel': 'src/providers/vercel.ts',
    'providers/tiktok': 'src/providers/tiktok.ts',
    'providers/posthog': 'src/providers/posthog.ts',
    'providers/sentry': 'src/providers/sentry.ts',
    'sentry/server': 'src/sentry/server.ts',
    'sentry/next': 'src/sentry/next.ts',
    'server/index': 'src/server/index.ts',
    'server/ga4': 'src/server/ga4.ts',
    'server/meta': 'src/server/meta.ts',
    testing: 'src/testing.ts',
    next: 'src/next.tsx',
  },
  dts: true,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  async onSuccess() {
    // esbuild drops module directives; prepended on line 1 so the sourcemaps stay aligned.
    for (const entry of ['dist/react/index.js', 'dist/next.js']) {
      await writeFile(entry, `'use client';${await readFile(entry, 'utf8')}`)
    }
  },
})
