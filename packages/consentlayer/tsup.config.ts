import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

const cdnShims: Record<string, string> = {
  'posthog-js': 'posthog',
  'posthog-js/dist/posthog-recorder': 'posthog-recorder',
  './sentry-sdk': 'sentry',
  './sentry-replay': 'sentry',
  './sentry-tracing': 'sentry',
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      ecommerce: 'src/ecommerce.ts',
      'auto-tracking': 'src/auto-tracking.ts',
      banner: 'src/banner.ts',
      testing: 'src/testing.ts',
      next: 'src/next.tsx',
      vue: 'src/vue.ts',
      svelte: 'src/svelte.ts',
      sveltekit: 'src/sveltekit.ts',
      solid: 'src/solid.ts',
      solidstart: 'src/solidstart.ts',
      angular: 'src/angular.ts',
      'react/index': 'src/react/index.ts',
      'react/banner': 'src/react/banner.tsx',
      'providers/meta': 'src/providers/meta.ts',
      'providers/ga4': 'src/providers/ga4.ts',
      'providers/gtm': 'src/providers/gtm.ts',
      'providers/contentsquare': 'src/providers/contentsquare.ts',
      'providers/hotjar': 'src/providers/hotjar.ts',
      'providers/vercel': 'src/providers/vercel.ts',
      'providers/tiktok': 'src/providers/tiktok.ts',
      'providers/posthog': 'src/providers/posthog.ts',
      'providers/sentry': 'src/providers/sentry.ts',
      'adapters/shopify': 'src/adapters/shopify.ts',
      'adapters/tcf': 'src/adapters/tcf.ts',
      'adapters/google-consent-mode': 'src/adapters/google-consent-mode.ts',
      'sentry/server': 'src/sentry/server.ts',
      'sentry/next': 'src/sentry/next.ts',
      'server/index': 'src/server/index.ts',
      'server/ga4': 'src/server/ga4.ts',
      'server/meta': 'src/server/meta.ts',
      'server/sgtm': 'src/server/sgtm.ts',
      'server/tiktok': 'src/server/tiktok.ts',
      'vue/banner': 'src/vue/banner.ts',
      'svelte/banner': 'src/svelte/banner.ts',
      'solid/banner': 'src/solid/banner.ts',
      'angular/banner': 'src/angular/banner.ts',
      'nuxt/index': 'src/nuxt/index.ts',
      'nuxt/plugin': 'src/nuxt/plugin.ts',
      'nuxt/config': 'src/nuxt/config.ts',
    },
    dts: true,
    format: ['esm'],
    clean: ['!*.global.js'],
    sourcemap: true,
    treeshake: { moduleSideEffects: false },
    external: [
      'react',
      'react-dom',
      'vue',
      'svelte',
      'nuxt',
      'solid-js',
      /^solid-js\//,
      '@solidjs/router',
      /^@angular\//,
      /^consentlayer/,
      /^#build\//,
      /^\$app\//,
      /\.svelte$/,
    ],
    async onSuccess() {
      // esbuild drops module directives; prepended on line 1 so the sourcemaps stay aligned.
      for (const entry of ['dist/react/index.js', 'dist/react/banner.js', 'dist/next.js']) {
        await writeFile(entry, `'use client';${await readFile(entry, 'utf8')}`)
      }
    },
  },
  {
    entry: { consentlayer: 'src/global/index.ts', 'consentlayer-banner': 'src/global/banner.ts' },
    format: ['iife'],
    platform: 'browser',
    minify: true,
    noExternal: [/./],
    esbuildPlugins: [
      {
        name: 'cdn-shims',
        setup(build) {
          build.onResolve(
            { filter: /^(posthog-js(\/dist\/posthog-recorder)?|\.\/sentry-(sdk|replay|tracing))$/ },
            ({ path }) => ({
              path: resolve(import.meta.dirname, `src/global/cdn/${cdnShims[path]}.ts`),
            }),
          )
        },
      },
    ],
  },
])
