import type {
  AnalyticsError,
  AnalyticsErrorScope,
  AnalyticsEventPayload,
  AnalyticsManager,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  ProviderAdapter,
} from './types'
import { getDefaultIdentityStorage } from './identity'
import {
  createMemoryIdentityStorage,
  createMemoryConsentStorage,
} from './storage'
import {
  defaultRuntimePreset,
} from './presets'
import {
  debugLog,
  getWindowLocation,
  hasRequiredConsent,
  isBrowser,
} from './utils'

type ProviderState = {
  adapter: ProviderAdapter
  setup: boolean
  active: boolean
}

export function createAnalyticsManager(
  options: AnalyticsManagerOptions = {},
): AnalyticsManager {
  const listeners = new Set<(snapshot: AnalyticsManagerStateSnapshot) => void>()
  const providerStates = new Map<string, ProviderState>()
  const identityStorage = options.identityStorage ?? getDefaultIdentityStorage()
  const defaultEventDestinations = options.defaultEventDestinations ?? []
  let consent = options.consent ?? options.consentEngine?.getConsent() ?? null
  let booted = false
  let destroyed = false
  let lifecycleQueue = Promise.resolve()
  let unsubscribeConsent: (() => void) | undefined
  let autoBound = false
  let activeScrollHandler: ((event: Event) => void) | null = null
  let activeClickHandler: ((event: Event) => void) | null = null
  let pageSessionIdCounter = 0
  let timeouts: number[] = []

  const snapshot = (): AnalyticsManagerStateSnapshot => ({
    booted,
    consent,
    activeProviders: [...providerStates.values()]
      .filter((state) => state.active)
      .map((state) => state.adapter.id),
  })

  let currentSnapshot = snapshot()

  const refreshSnapshot = () => {
    currentSnapshot = snapshot()
  }

  const notify = () => {
    refreshSnapshot()
    listeners.forEach((listener) => listener(currentSnapshot))
  }

  const runtimeEnabled = () => {
    if (typeof options.enabled === 'function') return options.enabled()
    if (typeof options.enabled === 'boolean') return options.enabled
    return true
  }

  const emitError = (error: AnalyticsError) => {
    debugLog(options.debug ?? false, `[${error.scope}] ${error.message}`, error.cause)
    try {
      options.onError?.(error)
    } catch (handlerError) {
      debugLog(
        options.debug ?? false,
        'onError handler threw',
        handlerError,
      )
    }
  }

  const providerEmitError =
    (providerId: string) => (error: AnalyticsError) =>
      emitError({ ...error, providerId: error.providerId ?? providerId })

  const context = (providerId?: string) => ({
    consent,
    identity: identityStorage.read(),
    debug: options.debug ?? false,
    isBooted: booted,
    emitError: providerId ? providerEmitError(providerId) : emitError,
  })

  const scopeForLabel = (label: string): AnalyticsErrorScope => {
    if (label.endsWith('.setup')) return 'provider-setup'
    if (label.endsWith('.init')) return 'provider-init'
    if (label.endsWith('.teardown')) return 'provider-teardown'
    if (label.endsWith('.onConsentChange')) return 'provider-consent-change'
    if (label.endsWith('.trackEvent')) return 'provider-track-event'
    if (label.endsWith('.trackPage')) return 'provider-track-page'
    return 'provider-setup'
  }

  const ensureProviderState = (provider: ProviderAdapter): ProviderState => {
    const existing = providerStates.get(provider.id)
    if (existing) return existing
    const created: ProviderState = {
      adapter: provider,
      setup: false,
      active: false,
    }
    providerStates.set(provider.id, created)
    return created
  }

  const safeCall = async (
    label: string,
    callback: (() => Promise<void> | void) | undefined,
  ) => {
    if (!callback || destroyed) return
    try {
      await Promise.resolve(callback())
    } catch (error) {
      const [providerId] = label.split('.')
      emitError({
        scope: scopeForLabel(label),
        providerId,
        message: `${label} failed`,
        cause: error,
      })
    }
  }

  const ensureSetup = async (state: ProviderState) => {
    if (state.setup || !booted || !runtimeEnabled()) return
    const enabled = state.adapter.enabled?.(context(state.adapter.id)) ?? true
    if (!enabled) return
    await safeCall(`${state.adapter.id}.setup`, () =>
      state.adapter.setup?.(context(state.adapter.id)),
    )
    state.setup = true
  }

  const evaluateProvider = async (state: ProviderState) => {
    const enabled =
      runtimeEnabled() &&
      (state.adapter.enabled?.(context(state.adapter.id)) ?? true)
    const allowed = hasRequiredConsent(consent, state.adapter.requiredConsent)

    if (booted && enabled) {
      await ensureSetup(state)
      await safeCall(`${state.adapter.id}.onConsentChange`, () =>
        state.adapter.onConsentChange?.(context(state.adapter.id)),
      )
    }

    if (booted && enabled && allowed && !state.active) {
      await safeCall(`${state.adapter.id}.init`, () =>
        state.adapter.init?.(context(state.adapter.id)),
      )
      state.active = true
      return
    }

    if ((!booted || !enabled || !allowed) && state.active) {
      await safeCall(`${state.adapter.id}.teardown`, () =>
        state.adapter.teardown?.(context(state.adapter.id)),
      )
      state.active = false
    }
  }

  const runLifecycle = async () => {
    for (const state of providerStates.values()) {
      await evaluateProvider(state)
    }
    notify()
  }

  const queueLifecycle = async () => {
    lifecycleQueue = lifecycleQueue.then(runLifecycle)
    await lifecycleQueue
  }

  const trackAgainstProviders = async (
    selectedProviderIds: string[],
    callback: (state: ProviderState) => Promise<void>,
  ) => {
    if (!booted || !runtimeEnabled()) return
    for (const state of providerStates.values()) {
      if (!state.active) continue
      if (selectedProviderIds.length > 0 && !selectedProviderIds.includes(state.adapter.id)) {
        continue
      }
      await callback(state)
    }
  }

  const clearSessionTimers = () => {
    for (const timer of timeouts) {
      window.clearTimeout(timer)
    }
    timeouts = []
  }

  const startPageSession = () => {
    if (!isBrowser()) return
    clearSessionTimers()
    pageSessionIdCounter += 1
    const sessionId = pageSessionIdCounter
    void api.trackEvent(
      defaultRuntimePreset.autoTrackingEvents.pageSessionStart,
      { session_id: sessionId },
    )

    const scrollMarks = new Set<number>()
    const emitDepth = (depth: number) => {
      if (scrollMarks.has(depth)) return
      scrollMarks.add(depth)
      void api.trackEvent(defaultRuntimePreset.autoTrackingEvents.scrollDepth, {
        depth,
        session_id: sessionId,
      })
    }

    if (activeScrollHandler) {
      window.removeEventListener('scroll', activeScrollHandler)
    }

    activeScrollHandler = () => {
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop
      const total = doc.scrollHeight - window.innerHeight
      if (total <= 0) return
      const ratio = Math.min(1, scrollTop / total)
      const depth = Math.round(ratio * 100)
      if (depth >= 25) emitDepth(25)
      if (depth >= 50) emitDepth(50)
      if (depth >= 75) emitDepth(75)
      if (depth >= 95) emitDepth(100)
      if (scrollMarks.size === 4 && activeScrollHandler) {
        window.removeEventListener('scroll', activeScrollHandler)
      }
    }

    window.addEventListener('scroll', activeScrollHandler, { passive: true })

    for (const seconds of [5, 15, 30, 60, 120]) {
      const handle = window.setTimeout(() => {
        if (sessionId !== pageSessionIdCounter) return
        void api.trackEvent(defaultRuntimePreset.autoTrackingEvents.timeOnPage, {
          seconds,
          session_id: sessionId,
        })
      }, seconds * 1000)
      timeouts.push(handle)
    }
  }

  if (options.consentEngine) {
    unsubscribeConsent = options.consentEngine.subscribe(({ consent: nextConsent }) => {
      void api.updateConsent(nextConsent)
    })
  }

  for (const provider of options.providers ?? []) {
    ensureProviderState(provider)
  }

  const api: AnalyticsManager = {
    async boot() {
      if (destroyed || booted) return
      booted = true
      await queueLifecycle()
    },
    registerProvider(provider) {
      const state = ensureProviderState(provider)
      if (booted) {
        void ensureSetup(state).then(queueLifecycle)
      } else {
        refreshSnapshot()
        notify()
      }
      return () => {
        if (!providerStates.has(provider.id)) return
        if (state.active) {
          void safeCall(`${provider.id}.teardown`, () =>
            provider.teardown?.(context(provider.id)),
          )
        }
        providerStates.delete(provider.id)
        notify()
      }
    },
    async updateConsent(nextConsent) {
      consent = nextConsent
      await queueLifecycle()
    },
    getConsent() {
      return consent
    },
    async trackPage(payload = {}) {
      const page = { ...getWindowLocation(), ...payload }
      await trackAgainstProviders([], async (state) => {
        await safeCall(`${state.adapter.id}.trackPage`, () =>
          state.adapter.trackPage?.(page, context(state.adapter.id)),
        )
      })
    },
    async trackEvent(name, params = {}, optionsInput = {}) {
      const event: AnalyticsEventPayload = {
        name,
        params,
        options: optionsInput,
      }
      const requireAnalyticsConsent =
        optionsInput.requireAnalyticsConsent ?? true
      const requireMarketingConsent =
        optionsInput.requireMarketingConsent ?? false
      const destinations =
        optionsInput.sendTo ??
        (defaultEventDestinations.length
          ? defaultEventDestinations
          : [...providerStates.keys()])

      if (requireAnalyticsConsent && !consent?.analytics) return
      if (requireMarketingConsent && !consent?.marketing) return

      await trackAgainstProviders(destinations, async (state) => {
        if (!hasRequiredConsent(consent, state.adapter.requiredConsent)) return
        await safeCall(`${state.adapter.id}.trackEvent`, () =>
          state.adapter.trackEvent?.(event, context(state.adapter.id)),
        )
      })
    },
    enableAutoTracking() {
      if (!isBrowser() || autoBound) return
      autoBound = true

      activeClickHandler = (event) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        const button = target.closest(
          'button, [role="button"], a, input[type="submit"], input[type="button"]',
        )
        if (!(button instanceof HTMLElement)) return
        const name =
          button.getAttribute('data-track') ||
          button.getAttribute('aria-label') ||
          button.getAttribute('name') ||
          button.textContent?.trim()?.slice(0, 80) ||
          'unknown'
        void api.trackEvent(defaultRuntimePreset.autoTrackingEvents.uiClick, {
          ui_target: name,
          ui_element: button.tagName.toLowerCase(),
          ui_id: button.id || undefined,
          path: window.location.pathname,
          session_id: pageSessionIdCounter || undefined,
        })
      }

      window.addEventListener('click', activeClickHandler)
      startPageSession()
    },
    newPageSession() {
      startPageSession()
    },
    getSnapshot() {
      return currentSnapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy() {
      destroyed = true
      unsubscribeConsent?.()
      clearSessionTimers()
      if (activeScrollHandler && isBrowser()) {
        window.removeEventListener('scroll', activeScrollHandler)
      }
      if (activeClickHandler && isBrowser()) {
        window.removeEventListener('click', activeClickHandler)
      }
      for (const state of providerStates.values()) {
        if (state.active) {
          void safeCall(`${state.adapter.id}.teardown`, () =>
            state.adapter.teardown?.(context(state.adapter.id)),
          )
        }
      }
      providerStates.clear()
      listeners.clear()
    },
  }

  return api
}

let defaultAnalyticsManager: AnalyticsManager | null = null

export function getDefaultAnalyticsManager(): AnalyticsManager {
  if (!defaultAnalyticsManager) {
    const fallbackIdentity = getDefaultIdentityStorage()
    defaultAnalyticsManager = createAnalyticsManager({
      identityStorage: fallbackIdentity ?? createMemoryIdentityStorage(),
      consent: createMemoryConsentStorage().read(),
    })
  }
  return defaultAnalyticsManager
}

export function setDefaultAnalyticsManager(manager: AnalyticsManager): void {
  defaultAnalyticsManager = manager
}
