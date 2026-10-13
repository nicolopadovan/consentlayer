import type {
  AnalyticsError,
  AnalyticsEventPayload,
  AnalyticsManager,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  AnalyticsPlugin,
  AutoTrackingConfig,
  PluginContext,
  ServerEvent,
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
import { assertHttpsOrRelativeUrl } from './validation'

type ProviderState = {
  plugin: AnalyticsPlugin
  setup: boolean
  loaded: boolean
  active: boolean
}

type HookName = Exclude<keyof AnalyticsPlugin, 'id' | 'requiredConsent' | 'loadBeforeConsent'>

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
  const stored = identityStorage.read()
  let identity: UserIdentity = stored.userId ? { userId: stored.userId } : {}
  let storedContact: UserIdentity | undefined =
    stored.email || stored.phone ? stored : undefined
  const settleStoredContact = () => {
    if (!storedContact || !consent) return
    if (consent.marketing && identity.userId === storedContact.userId) {
      identity = { ...storedContact, ...identity }
    }
    storedContact = undefined
  }
  settleStoredContact()
  const pending: Array<() => Promise<void>> = []
  let booted = false
  let ready = false
  let identifyQueued = false
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
      .map((state) => state.plugin.id),
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

  const serverEndpoint =
    options.server && assertHttpsOrRelativeUrl(options.server.endpoint, 'server.endpoint')

  const forward = (event: Omit<ServerEvent, 'consent' | 'identity'>) => {
    if (!serverEndpoint || !(consent?.analytics || consent?.marketing)) return
    const body = JSON.stringify({ ...event, consent, identity: sharedIdentity() })
    const fail = (cause: unknown) =>
      emitError({ scope: 'server-forward', message: `Sending ${event.name} to ${serverEndpoint} failed`, cause })
    if (typeof fetch !== 'function') {
      if (!navigator.sendBeacon(serverEndpoint, new Blob([body], { type: 'application/json' }))) {
        fail(undefined)
      }
      return
    }
    fetch(serverEndpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      })
      .catch(fail)
  }

  const sharedIdentity = (): UserIdentity =>
    consent?.marketing ? identity : identity.userId ? { userId: identity.userId } : {}

  const persistIdentity = () => {
    const stored = sharedIdentity()
    if (Object.keys(stored).length) identityStorage.write(stored)
    else identityStorage.clear?.()
  }

  const context = (providerId: string): PluginContext => ({
    consent,
    identity: sharedIdentity(),
    debug: options.debug ?? false,
    emitError: providerEmitError(providerId),
  })

  const call = async (
    state: ProviderState,
    hook: HookName,
    run: (plugin: AnalyticsPlugin, ctx: PluginContext) => Promise<void> | void,
  ) => {
    if (destroyed) return
    const { plugin } = state
    try {
      await run(plugin, context(plugin.id))
    } catch (error) {
      emitError({
        scope: hook === 'reset' || hook === 'group' ? 'provider-identify' : `provider-${hook}`,
        providerId: plugin.id,
        message: `${plugin.id}.${hook} failed`,
        cause: error,
      })
    }
  }

  const ensureProviderState = (plugin: AnalyticsPlugin): ProviderState => {
    const existing = providerStates.get(plugin.id)
    if (existing) return existing
    const created: ProviderState = { plugin, setup: false, loaded: false, active: false }
    providerStates.set(plugin.id, created)
    return created
  }

  const teardown = async (state: ProviderState) => {
    if (!state.active) return
    state.active = false
    await call(state, 'teardown', (plugin, ctx) => plugin.teardown?.(ctx))
  }

  const evaluateProvider = async (state: ProviderState) => {
    if (!booted || !runtimeEnabled()) return teardown(state)
    const { plugin } = state
    const allowed = hasRequiredConsent(consent, plugin.requiredConsent)
    if (!state.setup) {
      state.setup = true
      await call(state, 'setup', (p, ctx) => p.setup?.(ctx))
    }
    await call(state, 'consent', (p, ctx) => p.consent?.(ctx))
    if (!state.loaded && (allowed || plugin.loadBeforeConsent)) {
      state.loaded = true
      await call(state, 'load', (p, ctx) => p.load?.(ctx))
    }
    if (!allowed) return teardown(state)
    if (state.active) return
    state.active = true
    const shared = sharedIdentity()
    if (Object.keys(shared).length && !identifyQueued) {
      await call(state, 'identify', (p, ctx) => p.identify?.(shared, {}, ctx))
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
    serverEvent?: () => Omit<ServerEvent, 'consent' | 'identity'> | undefined,
  ) => {
    if (destroyed || !runtimeEnabled()) return
    if (!ready) {
      // ponytail: fixed cap; calls past it are dropped until boot
      if (pending.length < 100) {
        pending.push(() => deliver(selectedProviderIds, callback, serverEvent))
      }
      return
    }
    await deliver(selectedProviderIds, callback, serverEvent)
  }

  const deliver = async (
    selectedProviderIds: string[] | undefined,
    callback: (state: ProviderState) => Promise<void>,
    serverEvent?: () => Omit<ServerEvent, 'consent' | 'identity'> | undefined,
  ) => {
    if (destroyed) return
    const event = serverEvent?.()
    if (event) forward(event)
    for (const state of providerStates.values()) {
      if (!state.active) continue
      if (!hasRequiredConsent(consent, state.plugin.requiredConsent)) continue
      if (selectedProviderIds && !selectedProviderIds.includes(state.plugin.id)) {
        continue
      }
      await callback(state)
    }
  }

  const identifyProviders = (traits: UserTraits, only?: string[]) =>
    trackAgainstProviders(only, async (state) => {
      await call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), traits, ctx))
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
      for (let run = pending.shift(); run; run = pending.shift()) await run()
      ready = true
      identifyQueued = false
    },
    registerProvider(provider) {
      const state = ensureProviderState(provider)
      if (booted) void queueLifecycle()
      else notify()
      return () => {
        if (!providerStates.has(provider.id)) return
        void teardown(state)
        providerStates.delete(provider.id)
        notify()
      }
    },
    async updateConsent(nextConsent) {
      const hadMarketing = Boolean(consent?.marketing)
      const hadContact = Boolean(identity.email || identity.phone)
      const wasActive = [...providerStates.values()]
        .filter((state) => state.active)
        .map((state) => state.plugin.id)
      consent = nextConsent
      if (!nextConsent) storedContact = undefined
      settleStoredContact()
      if (nextConsent && !nextConsent.marketing) {
        identity = identity.userId ? { userId: identity.userId } : {}
      }
      persistIdentity()
      await queueLifecycle()
      if (!hadContact || hadMarketing === Boolean(nextConsent?.marketing)) return
      if (hadMarketing) {
        for (const state of providerStates.values()) {
          if (!state.setup) continue
          await call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), {}, ctx))
        }
      } else if (wasActive.length) {
        await identifyProviders({}, wasActive)
      }
    },
    getConsent() {
      return consent
    },
    async page(payload = {}, pageOptions = {}) {
      const page = { ...getWindowLocation(), ...payload, id: createEventId() }
      await trackAgainstProviders(
        pageOptions.only,
        async (state) => {
          await call(state, 'page', (p, ctx) => p.page?.(page, ctx))
        },
        () => ({ id: page.id, name: 'page_view', url: page.url, only: pageOptions.only }),
      )
    },
    async track(name, params, optionsInput = {}) {
      const event: AnalyticsEventPayload = {
        id: optionsInput.eventId ?? createEventId(),
        name,
        params: params ?? {},
        options: optionsInput,
      }
      const allowed = () =>
        !(optionsInput.requireAnalyticsConsent && !consent?.analytics) &&
        !(optionsInput.requireMarketingConsent && !consent?.marketing)
      await trackAgainstProviders(
        optionsInput.only,
        async (state) => {
          if (allowed()) await call(state, 'track', (p, ctx) => p.track?.(event, ctx))
        },
        () =>
          allowed()
            ? {
                id: event.id,
                name,
                params: event.params,
                url: getWindowLocation().url,
                only: optionsInput.only,
                providers: optionsInput.providers,
              }
            : undefined,
      )
    },
    async identify(userId, traits = {}) {
      if (userId && userId !== identity.userId) identity = {}
      identity = {
        ...identity,
        ...normalizeIdentity({ userId, email: traits.email, phone: traits.phone }),
      }
      persistIdentity()
      if (!ready) identifyQueued = true
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
        await call(state, 'reset', (p, ctx) => p.reset?.(ctx))
      }
    },
    async group(groupId, traits = {}) {
      await trackAgainstProviders(undefined, async (state) => {
        await call(state, 'group', (p, ctx) => p.group?.(groupId, traits, ctx))
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
      for (const state of providerStates.values()) void teardown(state)
      providerStates.clear()
      listeners.clear()
    },
  }

  return api
}
