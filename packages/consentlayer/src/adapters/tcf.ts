import type { ConsentCategory, ConsentIntegrationAdapter, ConsentState } from '../core/types'

type TcData = {
  gdprApplies?: boolean
  eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete'
  listenerId?: number
  purpose?: { consents?: Record<number, boolean> }
}

type TcfApi = (command: string, version: number, callback: (...args: never[]) => void, parameter?: unknown) => void

declare global {
  interface Window {
    __tcfapi?: TcfApi
  }
}

/** Options for `tcf`. */
export type TcfOptions = {
  /** TCF purpose IDs per category, merged over the defaults. A category is granted when every listed purpose has consent. */
  purposes?: Partial<Record<ConsentCategory, number[]>>
  window?: Window
}

const defaultPurposes: Partial<Record<ConsentCategory, number[]>> = {
  preferences: [1],
  analytics: [1, 8],
  marketing: [1, 2, 3, 4, 7],
}

function listen(api: TcfApi, onData: (tcData: TcData | null) => boolean | void): () => void {
  let listenerId: number | undefined
  let stopped = false
  const remove = () => api('removeEventListener', 2, () => undefined, listenerId)
  api('addEventListener', 2, (tcData: TcData | null, success: boolean) => {
    if (success && tcData) listenerId = tcData.listenerId
    if (!stopped && onData(success && tcData ? tcData : null)) stopped = true
    if (stopped && listenerId !== undefined) remove()
  })
  return () => {
    stopped = true
    if (listenerId !== undefined) remove()
  }
}

/** Reads consent from the IAB TCF v2 CMP on the page through `__tcfapi`. Read-only: visitors change their choice in the CMP. */
export function tcf(options: TcfOptions = {}): ConsentIntegrationAdapter {
  const win = options.window ?? (typeof window !== 'undefined' ? window : undefined)
  const purposes = { ...defaultPurposes, ...options.purposes }
  const toConsent = (tcData: TcData) =>
    Object.fromEntries(
      Object.entries(purposes).map(([category, ids]) => [
        category,
        ids.length > 0 && ids.every((id) => tcData.purpose?.consents?.[id] === true),
      ]),
    ) as ConsentState

  return {
    id: 'tcf',
    bootstrap() {
      const api = win?.__tcfapi
      if (!api) return null
      return new Promise((resolve) => {
        listen(api, (tcData) => {
          resolve(tcData?.gdprApplies === true ? toConsent(tcData) : null)
          return true
        })
      })
    },
    subscribe(onConsent) {
      const api = win?.__tcfapi
      if (!api) return
      return listen(api, (tcData) => {
        if (tcData?.gdprApplies === true) onConsent(toConsent(tcData))
      })
    },
  }
}
