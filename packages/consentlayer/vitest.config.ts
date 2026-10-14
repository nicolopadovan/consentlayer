import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import rootConfig from '../../vitest.config.ts'

export default defineConfig({
  ...rootConfig,
  root: import.meta.dirname,
  plugins: [svelte()],
  resolve: {
    alias: [
      ...rootConfig.resolve.alias,
      { find: '$app/navigation', replacement: `${import.meta.dirname}/test/svelte/app-navigation.ts` },
    ],
    conditions: ['browser'],
  },
  test: {
    ...rootConfig.test,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    exclude: ['test/browser/**'],
    server: { deps: { inline: [/solid-js/, /@solidjs\/router/] } },
  },
})
