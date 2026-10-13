import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      {
        find: '@nicolopadovan/analytics-consent-manager/react',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/react/index.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/ecommerce',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/ecommerce.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/ui',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/ui/index.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/server',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/server/index.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/meta',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/meta.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/ga4',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/ga4.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/shopify',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/shopify.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/hotjar',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/hotjar.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/vercel',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/vercel.ts',
        ),
      },
      {
        find: '@nicolopadovan/analytics-consent-manager/providers/tiktok',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/tiktok.ts',
        ),
      },
      {
        find: /^@nicolopadovan\/analytics-consent-manager$/,
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/index.ts',
        ),
      },
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
