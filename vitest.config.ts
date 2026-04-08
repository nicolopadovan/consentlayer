import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      {
        find: '@your-scope/analytics-consent-manager/react',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/react/index.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/ui',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/ui/index.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/server',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/server/index.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/meta',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/meta.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/ga4',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/ga4.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/shopify',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/shopify.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/hotjar',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/hotjar.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/vercel',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/vercel.ts',
        ),
      },
      {
        find: '@your-scope/analytics-consent-manager/providers/tiktok',
        replacement: path.resolve(
          import.meta.dirname,
          'packages/analytics-consent-manager/src/providers/tiktok.ts',
        ),
      },
      {
        find: /^@your-scope\/analytics-consent-manager$/,
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
