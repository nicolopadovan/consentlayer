import { loadScript } from '../../core/plugin'
import { postHogAsset } from './posthog-host'

// Stands in for `posthog-js/dist/recorder` in the script-tag build. `import()` adopts a module namespace that exports `then`.
export function then(resolve: (module: object) => void, reject: (error: unknown) => void) {
  void loadScript(postHogAsset('lazy-recorder')).then(() => resolve({}), reject)
}
