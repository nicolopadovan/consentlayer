import { loadScript } from '../../core/plugin'

declare global {
  interface Window {
    Sentry?: typeof import('../../providers/sentry-sdk') &
      typeof import('../../providers/sentry-replay') &
      typeof import('../../providers/sentry-tracing')
  }
}

const sentryBundle = 'https://browser.sentry-cdn.com/11.7.0/bundle.tracing.replay.min.js'

// Stands in for `./sentry-sdk`, `./sentry-replay` and `./sentry-tracing` in the script-tag build.
// `import()` adopts a module namespace that exports `then`.
export function then(resolve: (module: Window['Sentry']) => void, reject: (error: unknown) => void) {
  void loadScript(sentryBundle, { crossorigin: 'anonymous' }).then(() => resolve(window.Sentry), reject)
}
