import type { AnalyticsPlugin } from './types'

export { getFlag, setFlag } from './names'

/** Types a plugin; the manager runs its hooks. */
export function definePlugin<T extends AnalyticsPlugin>(plugin: T): T {
  return plugin
}

const loading = new Map<string, Promise<void>>()

/** Appends `<script async src>` once per `src`. Resolves on load, rejects on error. */
export function loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  const href = new URL(src, document.baseURI).href
  const pending = loading.get(href)
  if (pending) return pending
  if ([...document.scripts].some((script) => script.src === href)) return Promise.resolve()
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = href
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value)
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      loading.delete(href)
      reject(new Error(`Failed to load ${src}`))
    }
    document.head.appendChild(script)
  })
  loading.set(href, promise)
  return promise
}
