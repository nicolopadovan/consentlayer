import { defineConfig } from 'vitest/config'
import rootConfig from '../../vitest.config'

export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: [
      'packages/analytics-consent-manager/test/**/*.test.ts',
      'packages/analytics-consent-manager/test/**/*.test.tsx',
    ],
  },
})
