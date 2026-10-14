import { defineConfig } from 'vitest/config'
import rootConfig from '../../vitest.config.ts'

export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ['apps/example-next/**/*.test.ts', 'apps/example-next/**/*.test.tsx'],
  },
})
