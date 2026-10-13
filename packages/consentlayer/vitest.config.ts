import { defineConfig } from 'vitest/config'
import rootConfig from '../../vitest.config'

export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: [
      'packages/consentlayer/test/**/*.test.ts',
      'packages/consentlayer/test/**/*.test.tsx',
    ],
  },
})
