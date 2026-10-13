import type { AnalyticsPlugin } from './types'

export { getFlag, setFlag } from './names'

/** Types a plugin; the manager runs its hooks. */
export function definePlugin<T extends AnalyticsPlugin>(plugin: T): T {
  return plugin
}

/** Appends `<script async src>` once per `src`. Resolves on load, rejects on error. */
export function loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if ([...document.scripts].some((script) => script.src === src)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = src
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}
