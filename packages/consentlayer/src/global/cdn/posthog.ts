import type { PostHog } from 'posthog-js'
import { loadScript } from '../../core/plugin'
import { postHogAsset } from './posthog-host'

declare global {
  interface Window {
    posthog?: PostHog
  }
}

// Stands in for `posthog-js` in the script-tag build. `import()` adopts a module namespace that exports `then`.
export function then(resolve: (module: { default: PostHog | undefined }) => void, reject: (error: unknown) => void) {
  void loadScript(postHogAsset('array')).then(() => resolve({ default: window.posthog }), reject)
}
