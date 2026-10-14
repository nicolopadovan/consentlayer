// esbuild flags tsup's chunk-ordering `import './chunk.js'` lines as ignored under sideEffects: false; they are inert.
// The Svelte component ships as source the app compiles, so it counts at its source size; `$app/*` is SvelteKit's.
const modifyEsbuildConfig = (config) => ({
  ...config,
  logOverride: { 'ignored-bare-import': 'silent' },
  loader: { ...config.loader, '.svelte': 'text' },
  external: [...(config.external ?? []), '$app/*'],
})

export default [
  ['core', 'dist/index.js', '7.8 kB'],
  ['core: createAnalytics only', 'dist/index.js', '6.3 kB', '{ createAnalytics }'],
  ['core: tree-shaken to createConsentController', 'dist/index.js', '1.5 kB', '{ createConsentController }'],
  ['auto-tracking', 'dist/auto-tracking.js', '1.2 kB'],
  ['react', 'dist/react/index.js', '2.5 kB'],
  ['next', 'dist/next.js', '2.5 kB'],
  ['vue', 'dist/vue.js', '2.5 kB'],
  ['svelte', 'dist/svelte.js', '2.5 kB'],
  ['sveltekit', 'dist/sveltekit.js', '2.5 kB'],
  ['solid', 'dist/solid.js', '2.5 kB'],
  ['solidstart', 'dist/solidstart.js', '2.5 kB'],
  ['angular', 'dist/angular.js', '2.5 kB'],
  ['providers/ga4', 'dist/providers/ga4.js', '2.5 kB'],
  ['providers/meta', 'dist/providers/meta.js', '2.5 kB'],
  ['providers/tiktok', 'dist/providers/tiktok.js', '2.1 kB'],
  ['providers/gtm', 'dist/providers/gtm.js', '2 kB'],
  ['providers/contentsquare', 'dist/providers/contentsquare.js', '1.2 kB'],
  ['providers/posthog', 'dist/providers/posthog.js', '1.2 kB'],
  ['providers/sentry', 'dist/providers/sentry.js', '1.2 kB'],
  ['server', 'dist/server/index.js', '2.7 kB'],
  ['server/meta', 'dist/server/meta.js', '1.5 kB'],
  ['server/tiktok', 'dist/server/tiktok.js', '1.4 kB'],
  ['server/sgtm', 'dist/server/sgtm.js', '1.5 kB'],
  ['script tag', 'dist/consentlayer.global.js', '15 kB'],
  ['script tag banner', 'dist/consentlayer-banner.global.js', '2 kB'],
].map(([name, path, limit, imports]) => ({ name, path, limit, import: imports, modifyEsbuildConfig }))
