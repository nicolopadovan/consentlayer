import type {
  AnalyticsError,
  AnalyticsErrorScope,
  AnalyticsEventPayload,
  AnalyticsManager,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  AutoTrackingConfig,
  ProviderAdapter,
  UserIdentity,
  UserTraits,
} from './types'
import { createMemoryIdentityStorage } from './storage'
import {
  defaultRuntimePreset,
} from './presets'
import {
  createEventId,
  debugLog,
  getWindowLocation,
  hasRequiredConsent,
  isBrowser,
  normalizeIdentity,
} from './utils'

type ProviderState = {
  adapter: ProviderAdapter
  setup: boolean
  active: boolean
}

const DEFAULT_CLICK_SELECTORS = [
  'button',
  '[role="button"]',
  'a',
  'input[type="submit"]',
  'input[type="button"]',
]
const DEFAULT_CLICK_ATTRIBUTE = 'data-track'
const DEFAULT_SCROLL_THRESHOLDS = [25, 50, 75, 100]
const DEFAULT_TIME_INTERVALS = [5, 15, 30, 60, 120]

type ResolvedAutoTracking = {
  clicks:
    | { enabled: false }
    | {
        enabled: true
        mode: 'all' | 'attribute'
        attribute: string
        selectors: string[]
      }
  scroll: { enabled: false } | { enabled: true; thresholds: number[] }
  timeOnPage: { enabled: false } | { enabled: true; intervals: number[] }
  pageViews: boolean
}

function resolveAutoTracking(
  config: AutoTrackingConfig | undefined,
): ResolvedAutoTracking {
  const clicks = config?.clicks
  const scroll = config?.scroll
  const time = config?.timeOnPage

  return {
    clicks:
      clicks === false
        ? { enabled: false }
        : {
            enabled: true,
            mode: (clicks === true || clicks == null ? undefined : clicks.mode) ?? 'all',
            attribute:
              (clicks === true || clicks == null ? undefined : clicks.attribute) ??
              DEFAULT_CLICK_ATTRIBUTE,
            selectors:
              (clicks === true || clicks == null ? undefined : clicks.selectors) ??
              DEFAULT_CLICK_SELECTORS,
          },
    scroll:
      scroll === false
        ? { enabled: false }
        : {
            enabled: true,
            thresholds:
              (scroll === true || scroll == null ? undefined : scroll.thresholds) ??
              DEFAULT_SCROLL_THRESHOLDS,
          },
    timeOnPage:
      time === false
        ? { enabled: false }
        : {
            enabled: true,
            intervals:
              (time === true || time == null ? undefined : time.intervals) ??
              DEFAULT_TIME_INTERVALS,
          },
    pageViews: config?.pageViews ?? true,
  }
}

export function createAnalyticsManager(
  options: AnalyticsManagerOptions = {},
): AnalyticsManager {
  const listeners = new Set<(snapshot: AnalyticsManagerStateSnapshot) => void>()
  const providerStates = new Map<string, ProviderState>()
  const identityStorage = options.identityStorage ?? createMemoryIdentityStorage()
  let consent = options.consent ?? options.consentEngine?.getConsent() ?? null
  let identity: UserIdentity = identityStorage.read()
  const pending: Array<() => Promise<void>> = []
  let booted = false
  let destroyed = false
  let lifecycleQueue = Promise.resolve()
  let unsubscribeConsent: (() => void) | undefined
  let autoBound = false
  let autoTracking: ResolvedAutoTracking = resolveAutoTracking(undefined)
  let activeScrollHandler: ((event: Event) => void) | null = null
  let activeClickHandler: ((event: Event) => void) | null = null
  let pageSessionIdCounter = 0
  let timeouts: number[] = []
  let autoOnly: string[] | undefined
  const autoTrack = (name: string, params: Record<string, unknown>) =>
    api.track(name, params, { only: autoOnly })

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

  const sharedIdentity = (): UserIdentity =>
    consent?.marketing ? identity : identity.userId ? { userId: identity.userId } : {}

  const persistIdentity = () => {
    identityStorage.clear?.()
    const stored = sharedIdentity()
    if (Object.keys(stored).length) identityStorage.write(stored)
  }

  const context = (providerId?: string) => ({
    consent,
    identity: sharedIdentity(),
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
    if (/\.(identify|reset|group)$/.test(label)) return 'provider-identify'
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
      const shared = sharedIdentity()
      if (Object.keys(shared).length) {
        await safeCall(`${state.adapter.id}.identify`, () =>
          state.adapter.identify?.(shared, {}, context(state.adapter.id)),
        )
      }
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
    const evaluated = consent
    for (const state of providerStates.values()) {
      await evaluateProvider(state)
    }
    if (options.autoTracking && booted && evaluated?.analytics) {
      api.enableAutoTracking(
        options.autoTracking === true ? undefined : options.autoTracking,
      )
    }
    notify()
  }

  const queueLifecycle = async () => {
    lifecycleQueue = lifecycleQueue.then(runLifecycle)
    await lifecycleQueue
  }

  const trackAgainstProviders = async (
    selectedProviderIds: string[] | undefined,
    callback: (state: ProviderState) => Promise<void>,
  ) => {
    if (destroyed || !runtimeEnabled()) return
    if (!booted) {
      // ponytail: fixed cap; calls past it are dropped until boot
      if (pending.length < 100) {
        pending.push(() => trackAgainstProviders(selectedProviderIds, callback))
      }
      return
    }
    for (const state of providerStates.values()) {
      if (!state.active) continue
      if (!hasRequiredConsent(consent, state.adapter.requiredConsent)) continue
      if (selectedProviderIds && !selectedProviderIds.includes(state.adapter.id)) {
        continue
      }
      await callback(state)
    }
  }

  const identifyProviders = (traits: UserTraits, only?: string[]) =>
    trackAgainstProviders(only, async (state) => {
      await safeCall(`${state.adapter.id}.identify`, () =>
        state.adapter.identify?.(sharedIdentity(), traits, context(state.adapter.id)),
      )
    })

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

    if (autoTracking.pageViews) {
      void autoTrack(
        defaultRuntimePreset.autoTrackingEvents.pageSessionStart,
        { session_id: sessionId },
      )
    }

    if (activeScrollHandler) {
      window.removeEventListener('scroll', activeScrollHandler)
      activeScrollHandler = null
    }

    if (autoTracking.scroll.enabled) {
      const thresholds = [...autoTracking.scroll.thresholds]
        .filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
        .sort((a, b) => a - b)
      const emitted = new Set<number>()
      const emitDepth = (threshold: number) => {
        if (emitted.has(threshold)) return
        emitted.add(threshold)
        void autoTrack(
          defaultRuntimePreset.autoTrackingEvents.scrollDepth,
          { depth: threshold, session_id: sessionId },
        )
      }

      activeScrollHandler = () => {
        const doc = document.documentElement
        const scrollTop = window.scrollY || doc.scrollTop
        const total = doc.scrollHeight - window.innerHeight
        if (total <= 0) return
        const ratio = Math.min(1, scrollTop / total)
        const depth = Math.round(ratio * 100)
        for (const threshold of thresholds) {
          // Allow a small buffer for the 100% threshold so it fires near the
          // bottom even when scroll math doesn't land exactly on 100.
          const triggerAt = threshold === 100 ? 95 : threshold
          if (depth >= triggerAt) emitDepth(threshold)
        }
        if (emitted.size === thresholds.length && activeScrollHandler) {
          window.removeEventListener('scroll', activeScrollHandler)
        }
      }

      window.addEventListener('scroll', activeScrollHandler, { passive: true })
    }

    if (autoTracking.timeOnPage.enabled) {
      for (const seconds of autoTracking.timeOnPage.intervals) {
        if (!Number.isFinite(seconds) || seconds <= 0) continue
        const handle = window.setTimeout(() => {
          if (sessionId !== pageSessionIdCounter) return
          void autoTrack(
            defaultRuntimePreset.autoTrackingEvents.timeOnPage,
            { seconds, session_id: sessionId },
          )
        }, seconds * 1000)
        timeouts.push(handle)
      }
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
      for (const run of pending.splice(0)) await run()
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
      const hadMarketing = Boolean(consent?.marketing)
      const hadContact = Boolean(identity.email || identity.phone)
      const wasActive = [...providerStates.values()]
        .filter((state) => state.active)
        .map((state) => state.adapter.id)
      consent = nextConsent
      if (!nextConsent) return queueLifecycle()
      if (hadMarketing && !nextConsent.marketing) {
        identity = identity.userId ? { userId: identity.userId } : {}
      }
      persistIdentity()
      await queueLifecycle()
      if (hadContact && hadMarketing !== nextConsent.marketing && wasActive.length) {
        await identifyProviders({}, wasActive)
      }
    },
    getConsent() {
      return consent
    },
    async page(payload = {}, pageOptions = {}) {
      const page = { ...getWindowLocation(), ...payload }
      await trackAgainstProviders(pageOptions.only, async (state) => {
        await safeCall(`${state.adapter.id}.trackPage`, () =>
          state.adapter.trackPage?.(page, context(state.adapter.id)),
        )
      })
    },
    async track(name, params, optionsInput = {}) {
      const event: AnalyticsEventPayload = {
        id: optionsInput.eventId ?? createEventId(),
        name,
        params: params ?? {},
        options: optionsInput,
      }
      if (optionsInput.requireAnalyticsConsent && !consent?.analytics) return
      if (optionsInput.requireMarketingConsent && !consent?.marketing) return

      await trackAgainstProviders(optionsInput.only, async (state) => {
        await safeCall(`${state.adapter.id}.trackEvent`, () =>
          state.adapter.trackEvent?.(event, context(state.adapter.id)),
        )
      })
    },
    async identify(userId, traits = {}) {
      if (userId && userId !== identity.userId) identity = {}
      identity = {
        ...identity,
        ...normalizeIdentity({ userId, email: traits.email, phone: traits.phone }),
      }
      persistIdentity()
      await identifyProviders(
        Object.fromEntries(
          Object.entries(traits).filter(([key]) => key !== 'email' && key !== 'phone'),
        ),
      )
    },
    async reset() {
      identity = {}
      identityStorage.clear?.()
      for (const state of providerStates.values()) {
        if (!state.setup) continue
        await safeCall(`${state.adapter.id}.reset`, () =>
          state.adapter.reset?.(context(state.adapter.id)),
        )
      }
    },
    async group(groupId, traits = {}) {
      await trackAgainstProviders(undefined, async (state) => {
        await safeCall(`${state.adapter.id}.group`, () =>
          state.adapter.group?.(groupId, traits, context(state.adapter.id)),
        )
      })
    },
    enableAutoTracking(config) {
      if (!isBrowser() || autoBound) return
      autoBound = true
      autoTracking = resolveAutoTracking(config)
      autoOnly = config?.only

      const clicks = autoTracking.clicks
      if (clicks.enabled) {
        const selectorList = clicks.selectors.join(', ')
        activeClickHandler = (event) => {
          const target = event.target as HTMLElement | null
          if (!target) return
          let element: HTMLElement | null = null
          if (clicks.mode === 'attribute') {
            const closest = target.closest(`[${clicks.attribute}]`)
            if (closest instanceof HTMLElement) element = closest
          } else {
            const closest = selectorList ? target.closest(selectorList) : null
            if (closest instanceof HTMLElement) element = closest
          }
          if (!element) return
          const name =
            element.getAttribute(clicks.attribute) ||
            element.getAttribute('aria-label') ||
            element.getAttribute('name') ||
            element.textContent?.trim()?.slice(0, 80) ||
            'unknown'
          void autoTrack(defaultRuntimePreset.autoTrackingEvents.uiClick, {
            ui_target: name,
            ui_element: element.tagName.toLowerCase(),
            ui_id: element.id || undefined,
            path: window.location.pathname,
            session_id: pageSessionIdCounter || undefined,
          })
        }

        window.addEventListener('click', activeClickHandler)
      }

      startPageSession()
    },
    newPageSession() {
      if (autoBound) startPageSession()
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
