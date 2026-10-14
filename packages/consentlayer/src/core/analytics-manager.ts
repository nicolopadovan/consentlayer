import type {
  AnalyticsError,
  AnalyticsEventPayload,
  AnalyticsManager,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  AnalyticsPlugin,
  AutoTrackingConfig,
  DebugTopic,
  LoadTiming,
  PluginContext,
  ServerEvent,
  UserIdentity,
  UserTraits,
} from './types'
import { createMemoryIdentityStorage } from './storage'
import { getNames } from './names'
import {
  createEventId,
  createDebugLog,
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
  /** Calls held while a deferred `load` is pending. */
  backlog?: Array<() => Promise<unknown>>
}

type HookName = Exclude<
  keyof AnalyticsPlugin,
  'id' | 'requiredConsent' | 'loadBeforeConsent' | 'defer'
>

const LIFECYCLE_HOOKS = new Set<HookName>(['setup', 'consent', 'load', 'teardown'])
const HOOK_TOPICS: Record<HookName, DebugTopic> = {
  setup: 'providers',
  consent: 'providers',
  load: 'providers',
  teardown: 'providers',
  page: 'events',
  track: 'events',
  identify: 'events',
  group: 'events',
  reset: 'events',
  error: 'errors',
}
const INTERACTIONS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function whenDue(timing: Exclude<LoadTiming, false>): Promise<void> {
  if (!isBrowser()) return Promise.resolve()
  return new Promise((resolve) => {
    if (typeof timing === 'number') {
      window.setTimeout(resolve, timing)
    } else if (timing === 'idle') {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout: 5000 })
      } else window.setTimeout(resolve, 1)
    } else {
      const done = () => {
        for (const type of INTERACTIONS) window.removeEventListener(type, done)
        resolve()
      }
      for (const type of INTERACTIONS) {
        window.addEventListener(type, done, { once: true, passive: true })
      }
    }
  })
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
  const { clicks, scroll, timeOnPage, pageViews } = config ?? {}
  const named = [clicks, scroll, timeOnPage, pageViews].some((kind) => kind != null && kind !== false)
  const on = (kind: unknown) => (kind == null ? !named : kind !== false)
  const settings = <T extends object>(kind: boolean | T | undefined): Partial<T> =>
    typeof kind === 'object' ? kind : {}

  return {
    clicks: on(clicks)
      ? {
          enabled: true,
          mode: settings(clicks).mode ?? 'all',
          attribute: settings(clicks).attribute ?? DEFAULT_CLICK_ATTRIBUTE,
          selectors: settings(clicks).selectors ?? DEFAULT_CLICK_SELECTORS,
        }
      : { enabled: false },
    scroll: on(scroll)
      ? { enabled: true, thresholds: settings(scroll).thresholds ?? DEFAULT_SCROLL_THRESHOLDS }
      : { enabled: false },
    timeOnPage: on(timeOnPage)
      ? { enabled: true, intervals: settings(timeOnPage).intervals ?? DEFAULT_TIME_INTERVALS }
      : { enabled: false },
    pageViews: on(pageViews),
  }
}

export function createAnalyticsManager(
  options: AnalyticsManagerOptions = {},
): AnalyticsManager {
  const debugLog = createDebugLog(options.debug)
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
  const pending: Array<() => Promise<unknown>> = []
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
    api.track(name, params, { only: autoOnly, requireAnalyticsConsent: true })

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
    debugLog('errors', error.providerId, `[${error.scope}] ${error.message}`, error.cause)
    try {
      options.onError?.(error)
    } catch (handlerError) {
      debugLog('errors', undefined, 'onError handler threw', handlerError)
    }
  }

  // ponytail: fixed cap so a runaway caller can't grow memory; overflow is reported once per queue
  const overflowed = new WeakSet<unknown[]>()
  const enqueue = (queue: Array<() => Promise<unknown>>, run: () => Promise<unknown>, providerId?: string) => {
    if (queue.length < 100) {
      queue.push(run)
    } else if (!overflowed.has(queue)) {
      overflowed.add(queue)
      emitError({
        scope: 'queue-full',
        providerId,
        message: `100 calls are already waiting ${providerId ? `for ${providerId} to load` : 'for boot'}; later ones are dropped`,
      })
    }
  }

  const providerEmitError =
    (providerId: string) => (error: AnalyticsError) =>
      emitError({ ...error, providerId: error.providerId ?? providerId })

  let serverEndpoint =
    options.server?.endpoint
      ? assertHttpsOrRelativeUrl(options.server.endpoint, 'server.endpoint')
      : undefined
  const consentEndpoint =
    options.server?.consentEndpoint
      ? assertHttpsOrRelativeUrl(options.server.consentEndpoint, 'server.consentEndpoint')
      : undefined
  let restoring = false

  const restoreConsentCookie = () => {
    if (!consentEndpoint || restoring) return
    restoring = true
    fetch(consentEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ consent, restored: true }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      })
      .catch((cause: unknown) =>
        emitError({ scope: 'server-forward', message: `Restoring the consent cookie at ${consentEndpoint} failed`, cause }),
      )
  }

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
        if (response.headers.get('consentlayer-forwarding') === 'off') serverEndpoint = undefined
        if (response.headers.get('consentlayer-consent') === 'missing') restoreConsentCookie()
      })
      .catch(fail)
  }

  const sharedIdentity = (): UserIdentity =>
    consent?.marketing ? identity : identity.userId ? { userId: identity.userId } : {}

  const persistIdentity = () => {
    const stored = sharedIdentity()
    if (Object.keys(stored).length && (consent?.analytics || consent?.marketing)) identityStorage.write(stored)
    else identityStorage.clear?.()
  }

  const context = (providerId: string): PluginContext => ({
    consent,
    identity: sharedIdentity(),
    debug: Boolean(options.debug),
    log: (message, ...data) => debugLog('providers', providerId, message, ...data),
    emitError: providerEmitError(providerId),
  })

  const call = async (
    state: ProviderState,
    hook: HookName,
    run: (plugin: AnalyticsPlugin, ctx: PluginContext) => Promise<void> | void,
    ...detail: unknown[]
  ): Promise<boolean> => {
    if (destroyed) return false
    const { plugin } = state
    if (state.backlog && !LIFECYCLE_HOOKS.has(hook)) {
      enqueue(state.backlog, () => call(state, hook, run, ...detail), plugin.id)
      return Boolean(plugin[hook])
    }
    if (plugin[hook]) debugLog(HOOK_TOPICS[hook], plugin.id, `${plugin.id}.${hook}`, ...detail)
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
    return Boolean(plugin[hook])
  }

  const ensureProviderState = (plugin: AnalyticsPlugin): ProviderState => {
    const existing = providerStates.get(plugin.id)
    if (existing) {
      if (existing.plugin !== plugin) {
        emitError({
          scope: 'provider-setup',
          providerId: plugin.id,
          message: `Another provider already uses the id "${plugin.id}"; this one is ignored`,
        })
      }
      return existing
    }
    const created: ProviderState = { plugin, setup: false, loaded: false, active: false }
    providerStates.set(plugin.id, created)
    return created
  }

  const teardown = async (state: ProviderState) => {
    if (!state.active) return
    state.active = false
    await call(state, 'teardown', (plugin, ctx) => plugin.teardown?.(ctx))
  }

  const setupProvider = async (state: ProviderState) => {
    if (state.setup) return
    state.setup = true
    await call(state, 'setup', (p, ctx) => p.setup?.(ctx))
  }

  const evaluateProvider = async (state: ProviderState) => {
    if (!booted || !runtimeEnabled()) return teardown(state)
    const { plugin } = state
    const allowed = hasRequiredConsent(consent, plugin.requiredConsent)
    await setupProvider(state)
    await call(state, 'consent', (p, ctx) => p.consent?.(ctx))
    if (!state.loaded && (allowed || plugin.loadBeforeConsent)) {
      state.loaded = true
      if (plugin.defer) deferLoad(state, plugin.defer)
      else await call(state, 'load', (p, ctx) => p.load?.(ctx))
    }
    if (!allowed) return teardown(state)
    if (state.active) return
    state.active = true
    if (Object.keys(sharedIdentity()).length && !identifyQueued) {
      await call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), {}, ctx))
    }
  }

  const deferLoad = (state: ProviderState, timing: Exclude<LoadTiming, false>) => {
    state.backlog = []
    void whenDue(timing).then(() => {
      lifecycleQueue = lifecycleQueue.then(async () => {
        const backlog = state.backlog ?? []
        state.backlog = undefined
        if (!state.active && !state.plugin.loadBeforeConsent) {
          state.loaded = false
          return
        }
        await call(state, 'load', (p, ctx) => p.load?.(ctx))
        for (const run of backlog) if (state.active) await run()
      })
    })
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

  const labelTopic = (label: string): DebugTopic => (label === 'captureError' ? 'errors' : 'events')

  const trackAgainstProviders = async (
    label: string,
    selectedProviderIds: string[] | undefined,
    callback: (state: ProviderState) => Promise<boolean>,
    serverEvent?: () => Omit<ServerEvent, 'consent' | 'identity'> | undefined,
  ) => {
    if (destroyed) return
    if (!runtimeEnabled()) return debugLog(labelTopic(label), undefined, `${label} dropped: enabled is false`)
    if (!ready) {
      debugLog(labelTopic(label), undefined, `${label} held until boot`)
      enqueue(pending, () => deliver(label, selectedProviderIds, callback, serverEvent))
      return
    }
    await deliver(label, selectedProviderIds, callback, serverEvent)
  }

  const deliver = async (
    label: string,
    selectedProviderIds: string[] | undefined,
    callback: (state: ProviderState) => Promise<boolean>,
    serverEvent?: () => Omit<ServerEvent, 'consent' | 'identity'> | undefined,
  ) => {
    if (destroyed) return
    const event = serverEvent?.()
    if (event) forward(event)
    let reached = 0
    for (const state of providerStates.values()) {
      if (!state.active) continue
      if (!hasRequiredConsent(consent, state.plugin.requiredConsent)) continue
      if (selectedProviderIds && !selectedProviderIds.includes(state.plugin.id)) {
        continue
      }
      if (await callback(state)) reached += 1
    }
    if (!reached) debugLog(labelTopic(label), undefined, `${label} reached no provider`)
  }

  const identifyProviders = (traits: UserTraits, only?: string[]) =>
    trackAgainstProviders('identify', only, (state) =>
      call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), traits, ctx), traits),
    )

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
        getNames().autoTrackingEvents.pageSessionStart,
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
          getNames().autoTrackingEvents.scrollDepth,
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
            getNames().autoTrackingEvents.timeOnPage,
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
    const state = ensureProviderState(provider)
    if (isBrowser() && runtimeEnabled()) void setupProvider(state)
  }

  const errorsEnabled = options.errors !== false
  const reportedErrors = new WeakSet<object>()
  const onWindowError = (event: ErrorEvent) =>
    void api.captureError(event.error ?? event.message, { source: 'global', level: 'fatal' })
  const onRejection = (event: PromiseRejectionEvent) =>
    void api.captureError(event.reason, { source: 'global' })
  const globalHandlers =
    errorsEnabled &&
    isBrowser() &&
    !(typeof options.errors === 'object' && options.errors.globalHandlers === false)

  const api: AnalyticsManager = {
    async boot() {
      if (destroyed || booted) return
      booted = true
      debugLog('providers', undefined, 'boot')
      if (globalHandlers) {
        window.addEventListener('error', onWindowError)
        window.addEventListener('unhandledrejection', onRejection)
      }
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
          if (state.active) await call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), {}, ctx))
          else if (state.setup) await call(state, 'reset', (p, ctx) => p.reset?.(ctx))
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
        'page',
        pageOptions.only,
        (state) => call(state, 'page', (p, ctx) => p.page?.(page, ctx), page),
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
        name,
        optionsInput.only,
        async (state) =>
          allowed() && (await call(state, 'track', (p, ctx) => (allowed() ? p.track?.(event, ctx) : undefined), name, event.params)),
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
      storedContact = undefined
      identityStorage.clear?.()
      for (const state of providerStates.values()) {
        if (!state.setup) continue
        await call(state, 'reset', (p, ctx) => p.reset?.(ctx))
      }
    },
    async group(groupId, traits = {}) {
      await trackAgainstProviders('group', undefined, (state) =>
        call(state, 'group', (p, ctx) => p.group?.(groupId, traits, ctx), groupId, traits),
      )
    },
    async captureError(error, errorContext = {}) {
      if (!errorsEnabled) return
      if (typeof error === 'object' && error !== null) {
        if (reportedErrors.has(error)) return
        reportedErrors.add(error)
      }
      const captured = { source: 'manual' as const, ...errorContext }
      await trackAgainstProviders('captureError', undefined, (state) =>
        call(state, 'error', (p, ctx) => p.error?.(error, captured, ctx), error),
      )
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
          void autoTrack(getNames().autoTrackingEvents.uiClick, {
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
      for (const state of providerStates.values()) void teardown(state)
      destroyed = true
      unsubscribeConsent?.()
      if (globalHandlers) {
        window.removeEventListener('error', onWindowError)
        window.removeEventListener('unhandledrejection', onRejection)
      }
      clearSessionTimers()
      if (activeScrollHandler && isBrowser()) {
        window.removeEventListener('scroll', activeScrollHandler)
      }
      if (activeClickHandler && isBrowser()) {
        window.removeEventListener('click', activeClickHandler)
      }
      providerStates.clear()
      listeners.clear()
    },
  }

  return api
}
