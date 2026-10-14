import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import rootConfig from '../../vitest.config'

export default defineConfig({
  ...rootConfig,
  root: import.meta.dirname,
  plugins: [svelte()],
  resolve: { ...rootConfig.resolve, conditions: ['browser'] },
  test: {
    ...rootConfig.test,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
})
