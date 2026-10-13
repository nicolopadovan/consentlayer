// esbuild flags tsup's chunk-ordering `import './chunk.js'` lines as ignored under sideEffects: false; they are inert.
const modifyEsbuildConfig = (config) => ({ ...config, logOverride: { 'ignored-bare-import': 'silent' } })

export default [
  ['core', 'dist/index.js', '7 kB'],
  ['react', 'dist/react/index.js', '2.5 kB'],
  ['next', 'dist/next.js', '2.5 kB'],
  ['providers/ga4', 'dist/providers/ga4.js', '1.8 kB'],
  ['providers/meta', 'dist/providers/meta.js', '2.5 kB'],
  ['providers/contentsquare', 'dist/providers/contentsquare.js', '1.2 kB'],
  ['providers/posthog', 'dist/providers/posthog.js', '1.2 kB'],
  ['providers/sentry', 'dist/providers/sentry.js', '1.2 kB'],
  ['server', 'dist/server/index.js', '2.5 kB'],
  ['server/meta', 'dist/server/meta.js', '1.5 kB'],
].map(([name, path, limit]) => ({ name, path, limit, modifyEsbuildConfig }))
