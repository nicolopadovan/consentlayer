import type {
  AnalyticsError,
  AnalyticsEventPayload,
  AnalyticsManager,
  AutoTracking,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  AnalyticsPlugin,
  DebugTopic,
  LoadTiming,
  ConsentState,
  PluginContext,
  ServerEvent,
  UserIdentity,
  UserTraits,
} from './types'
import { getNames } from './names'
import { setScriptNonce } from './plugin'
import { createMemoryIdentityStorage } from './storage'
import {
  createEventId,
  createDebugLog,
  createRedact,
  getCampaign,
  getWindowLocation,
  hasRequiredConsent,
  isBrowser,
  normalizeIdentity,
  receivesEvent,
  redactDeep,
  withCampaign,
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

type ServerPayload = Omit<ServerEvent, 'consent' | 'identity'>
type Delivered = { providers: Set<string>; server: Set<keyof ConsentState>; event?: ServerPayload }

const RECORDING_DEADLINE_MS = 3000

const BUILT_IN_CATEGORIES: readonly (keyof ConsentState)[] = ['preferences', 'analytics', 'marketing']

/** Wiring `createAnalytics` provides. */
type ManagerInternals = {
  /** Settles once the consent endpoint has recorded the latest choice, while a recording is in flight. */
  consentRecorded?: () => Promise<void> | undefined
}

type HookName = Exclude<keyof AnalyticsPlugin, 'id' | 'requiredConsent' | 'loadBeforeConsent' | 'defer' | 'events'>

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

function whenDue(timing: Exclude<LoadTiming, false>, signal: AbortSignal): Promise<void> {
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
        window.addEventListener(type, done, { once: true, passive: true, signal })
      }
    }
  })
}

export function createAnalyticsManager(
  options: AnalyticsManagerOptions = {},
  internals: ManagerInternals = {},
): AnalyticsManager {
  if (options.autoTracking !== undefined && typeof options.autoTracking !== 'function') {
    throw new Error('[consentlayer] autoTracking must be autoTracking() from consentlayer/auto-tracking')
  }
  const debugLog = createDebugLog(options.debug)
  const redact = createRedact(options.redact)
  const campaign = getCampaign(options.campaign)
  const campaignSent = new Set<string>()
  if (options.nonce) setScriptNonce(options.nonce)
  const listeners = new Set<(snapshot: AnalyticsManagerStateSnapshot) => void>()
  const providerStates = new Map<string, ProviderState>()
  const identityStorage = options.identityStorage ?? createMemoryIdentityStorage()
  let consent = options.consent ?? options.consentEngine?.getConsent() ?? null
  const stored = identityStorage.read()
  let identity: UserIdentity = stored.userId ? { userId: stored.userId } : {}
  let storedContact: UserIdentity | undefined = stored.email || stored.phone ? stored : undefined
  const settleStoredContact = () => {
    if (!storedContact || !consent) return
    if (consent.marketing && identity.userId === storedContact.userId) {
      identity = { ...storedContact, ...identity }
    }
    storedContact = undefined
  }
  settleStoredContact()
  const pending: Array<() => Promise<unknown>> = []
  const held: Array<(recorded: Promise<void> | undefined) => Promise<unknown>> = []
  const undecided = () =>
    Boolean(options.holdUntilChoice) && (options.consentEngine ? options.consentEngine.shouldAsk() : consent === null)
  let booted = false
  let ready = false
  let identifyQueued = false
  let destroyed = false
  const lifetime = new AbortController()
  let lifecycleQueue = Promise.resolve()
  let unsubscribeConsent: (() => void) | undefined
  let pageSession: (() => void) | undefined

  const snapshot = (): AnalyticsManagerStateSnapshot => ({
    booted,
    consent,
    activeProviders: [...providerStates.values()].filter((state) => state.active).map((state) => state.plugin.id),
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
  const enqueue = <Run>(queue: Run[], run: Run, waiting: string, providerId?: string) => {
    if (queue.length < 100) {
      queue.push(run)
    } else if (!overflowed.has(queue)) {
      overflowed.add(queue)
      emitError({
        scope: 'queue-full',
        providerId,
        message: `100 calls are already waiting ${waiting}; later ones are dropped`,
      })
    }
  }

  const providerEmitError = (providerId: string) => (error: AnalyticsError) =>
    emitError({ ...error, providerId: error.providerId ?? providerId })

  let serverEndpoint = options.server?.endpoint
    ? assertHttpsOrRelativeUrl(options.server.endpoint, 'server.endpoint')
    : undefined
  const consentEndpoint = options.server?.consentEndpoint
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
        emitError({
          scope: 'server-forward',
          message: `Restoring the consent cookie at ${consentEndpoint} failed`,
          cause,
        }),
      )
  }

  const serverKey = `${getNames().prefix}_server:${serverEndpoint}`
  const learned = (value?: string | null) => {
    try {
      if (value === null) sessionStorage.removeItem(serverKey)
      else if (value !== undefined) sessionStorage.setItem(serverKey, value)
      return sessionStorage.getItem(serverKey)
    } catch {
      return null
    }
  }
  const saved = serverEndpoint ? learned() : null
  if (saved === 'off') serverEndpoint = undefined
  let serverEvents = saved === null || saved === 'off' ? undefined : saved ? saved.split(',') : []
  const forwards = (event: Omit<ServerEvent, 'consent' | 'identity'>) =>
    Boolean(serverEndpoint && (consent?.analytics || consent?.marketing)) &&
    (!serverEvents || Boolean(event.only) || serverEvents.includes(event.name))
  const forward = (event: Omit<ServerEvent, 'consent' | 'identity'>, recorded?: Promise<void>) => {
    if (recorded) return void recorded.then(() => forward(event))
    if (!serverEndpoint || !forwards(event)) return
    send(serverEndpoint, event.name, JSON.stringify({ ...event, consent, identity: sharedIdentity() }))
  }
  const send = (endpoint: string, name: string, body: string) => {
    const fail = (cause: unknown) =>
      emitError({ scope: 'server-forward', message: `Sending ${name} to ${endpoint} failed`, cause })
    if (typeof fetch !== 'function') {
      if (!navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) {
        fail(undefined)
      }
      return
    }
    fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const off = response.headers.get('consentlayer-forwarding') === 'off'
        const names = response.headers.get('consentlayer-events')
        if (off) serverEndpoint = undefined
        serverEvents = names === null ? undefined : names ? names.split(',') : []
        learned(off ? 'off' : names)
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
    redact,
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
      enqueue(state.backlog, () => call(state, hook, run, ...detail), `for ${plugin.id} to load`, plugin.id)
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
    void whenDue(timing, lifetime.signal).then(() => {
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
    if (options.autoTracking && !pageSession && booted && evaluated?.analytics && isBrowser()) {
      pageSession = () => {}
      try {
        pageSession = options.autoTracking({
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed once Register declares events
          track: api.track as Parameters<AutoTracking>[0]['track'],
          signal: lifetime.signal,
        })
        pageSession()
      } catch (cause) {
        emitError({ scope: 'auto-tracking', message: 'Auto-tracking failed to start', cause })
      }
    }
    notify()
  }

  const queueLifecycle = async () => {
    lifecycleQueue = lifecycleQueue.then(runLifecycle)
    await lifecycleQueue
  }

  const labelTopic = (label: string): DebugTopic => (label === 'captureError' ? 'errors' : 'events')

  type Delivery = {
    label: string
    selectedProviderIds: string[] | undefined
    callback: (state: ProviderState) => Promise<boolean>
    /** `sending` is true when the event is about to be forwarded. */
    serverEvent?: (sending: boolean) => ServerPayload | undefined
    /** Set for calls `holdUntilChoice` may hold: whether the call's own consent options keep it from everyone. */
    blocked?: () => boolean
  }

  const untilRecorded = () => {
    const recording = internals.consentRecorded?.()
    if (!recording) return
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        lifetime.signal.removeEventListener('abort', done)
        resolve()
      }
      const timer = setTimeout(done, RECORDING_DEADLINE_MS)
      lifetime.signal.addEventListener('abort', done, { once: true })
      void recording.then(done)
    })
  }

  const trackAgainstProviders = async (delivery: Delivery) => {
    if (destroyed) return
    const { label } = delivery
    if (!runtimeEnabled()) return debugLog(labelTopic(label), undefined, `${label} dropped: enabled is false`)
    if (!ready) {
      debugLog(labelTopic(label), undefined, `${label} held until boot`)
      enqueue(pending, () => deliver(delivery), 'for boot')
      return
    }
    await deliver(delivery)
  }

  const deliver = async (
    delivery: Delivery,
    delivered: Delivered = { providers: new Set(), server: new Set() },
    recorded?: Promise<void>,
  ): Promise<void> => {
    if (destroyed) return
    const { label, selectedProviderIds, callback, serverEvent, blocked } = delivery
    const base = delivered.event ?? serverEvent?.(false)
    const serverCategories = (base?.categories ?? options.consentEngine?.categories ?? BUILT_IN_CATEGORIES).filter(
      (category) => !delivered.server.has(category),
    )
    const granted = serverCategories.filter((category) => consent?.[category])
    if (base && granted.length && forwards(base)) {
      const event = delivered.event ?? serverEvent?.(true) ?? base
      forward(delivered.server.size ? { ...event, categories: granted } : event, recorded)
      for (const category of granted) delivered.server.add(category)
      delivered.event = event
    }
    let reached = 0
    let withheld = false
    for (const state of providerStates.values()) {
      const { id } = state.plugin
      if (delivered.providers.has(id)) continue
      if (selectedProviderIds && !selectedProviderIds.includes(id)) continue
      if (!state.active || !hasRequiredConsent(consent, state.plugin.requiredConsent)) {
        withheld = true
        continue
      }
      if (await callback(state)) {
        delivered.providers.add(id)
        reached += 1
      }
    }
    const serverWithheld = Boolean(serverEndpoint && base && granted.length < serverCategories.length)
    if (blocked && undecided() && (withheld || serverWithheld || blocked())) {
      debugLog(labelTopic(label), undefined, `${label} held until the visitor chooses`)
      enqueue(held, (recorded) => deliver(delivery, delivered, recorded), 'for the visitor to choose')
      return
    }
    if (!reached) debugLog(labelTopic(label), undefined, `${label} reached no provider`)
  }

  const identifyProviders = (traits: UserTraits, only?: string[]) =>
    trackAgainstProviders({
      label: 'identify',
      selectedProviderIds: only,
      callback: (state) => call(state, 'identify', (p, ctx) => p.identify?.(sharedIdentity(), traits, ctx), traits),
    })

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
  const onRejection = (event: PromiseRejectionEvent) => void api.captureError(event.reason, { source: 'global' })
  const globalHandlers =
    errorsEnabled && isBrowser() && !(typeof options.errors === 'object' && options.errors.globalHandlers === false)

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
      const wasActive = [...providerStates.values()].filter((state) => state.active).map((state) => state.plugin.id)
      consent = nextConsent
      if (!nextConsent) storedContact = undefined
      settleStoredContact()
      if (nextConsent && !nextConsent.marketing) {
        identity = identity.userId ? { userId: identity.userId } : {}
      }
      persistIdentity()
      await queueLifecycle()
      const recorded = held.length ? untilRecorded() : undefined
      overflowed.delete(held)
      for (const run of held.splice(0)) await run(recorded)
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
    async page(payload = {}, { only, server } = {}) {
      const page = { ...redactDeep({ ...getWindowLocation(), ...payload }, redact), id: createEventId() }
      const firstFor = (key: string) => {
        if (!campaign.length || campaignSent.has(key)) return page
        campaignSent.add(key)
        return redactDeep(withCampaign(page, campaign), redact)
      }
      await trackAgainstProviders({
        label: 'page',
        selectedProviderIds: only,
        callback: (state) => call(state, 'page', (p, ctx) => p.page?.(firstFor(p.id), ctx), page),
        serverEvent: (sending) => {
          if (server === false) return undefined
          const categories = Array.isArray(server) ? server : undefined
          const event = { id: page.id, name: 'page_view', url: page.url, only: server ? undefined : only, categories }
          return sending ? { ...event, url: firstFor(`server:${categories?.join() ?? ''}`).url } : event
        },
        blocked: () => false,
      })
    },
    async track(name, params, optionsInput = {}) {
      const event: AnalyticsEventPayload = {
        id: optionsInput.eventId ?? createEventId(),
        name,
        params: redactDeep(params ?? {}, redact),
        options: optionsInput,
      }
      const url = redactDeep(getWindowLocation().url, redact)
      const allowed = () =>
        !(optionsInput.requireAnalyticsConsent && !consent?.analytics) &&
        !(optionsInput.requireMarketingConsent && !consent?.marketing)
      await trackAgainstProviders({
        label: name,
        selectedProviderIds: optionsInput.only,
        callback: async (state) =>
          allowed() &&
          receivesEvent(state.plugin, name, optionsInput.only) &&
          (await call(state, 'track', (p, ctx) => (allowed() ? p.track?.(event, ctx) : undefined), name, event.params)),
        serverEvent: () =>
          allowed()
            ? {
                id: event.id,
                name,
                params: event.params,
                url,
                only: optionsInput.only,
                providers: optionsInput.providers,
              }
            : undefined,
        blocked: () => !allowed(),
      })
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
        Object.fromEntries(Object.entries(traits).filter(([key]) => key !== 'email' && key !== 'phone')),
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
      await trackAgainstProviders({
        label: 'group',
        selectedProviderIds: undefined,
        callback: (state) => call(state, 'group', (p, ctx) => p.group?.(groupId, traits, ctx), groupId, traits),
      })
    },
    async captureError(error, errorContext = {}) {
      if (!errorsEnabled) return
      if (typeof error === 'object' && error !== null) {
        if (reportedErrors.has(error)) return
        reportedErrors.add(error)
      }
      const captured = { source: 'manual' as const, ...errorContext }
      await trackAgainstProviders({
        label: 'captureError',
        selectedProviderIds: undefined,
        callback: (state) => call(state, 'error', (p, ctx) => p.error?.(error, captured, ctx), error),
      })
    },
    newPageSession() {
      try {
        pageSession?.()
      } catch (cause) {
        emitError({ scope: 'auto-tracking', message: 'Auto-tracking failed to start a page session', cause })
      }
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
      lifetime.abort()
      unsubscribeConsent?.()
      if (globalHandlers) {
        window.removeEventListener('error', onWindowError)
        window.removeEventListener('unhandledrejection', onRejection)
      }
      providerStates.clear()
      listeners.clear()
      held.length = 0
    },
  }

  return api
}
