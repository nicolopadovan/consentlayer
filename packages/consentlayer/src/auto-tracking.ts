import { getNames } from './core/names'
import type { AutoTracking, AutoTrackingConfig } from './core/types'

export type {
  AutoTracking,
  AutoTrackingClickConfig,
  AutoTrackingClickMode,
  AutoTrackingConfig,
  AutoTrackingDownloadConfig,
  AutoTrackingScrollConfig,
  AutoTrackingSiteSearchConfig,
  AutoTrackingTimeConfig,
} from './core/types'

const DEFAULT_CLICK_SELECTORS = ['button', '[role="button"]', 'a', 'input[type="submit"]', 'input[type="button"]']
const DEFAULT_SCROLL_THRESHOLDS = [25, 50, 75, 100]
const DEFAULT_TIME_INTERVALS = [5, 15, 30, 60, 120]
const DEFAULT_DOWNLOAD_EXTENSIONS =
  'pdf xls xlsx doc docx txt rtf csv exe key pps ppt pptx 7z pkg rar gz zip avi mov mp4 mpe mpeg wmv mid midi mp3 wav wma'.split(
    ' ',
  )
const DEFAULT_SEARCH_PARAMS = ['q', 's', 'search', 'query', 'keyword']
const VIDEO_PERCENTS = [10, 25, 50, 75]
const YOUTUBE_ORIGIN = /^https:\/\/www\.youtube(-nocookie)?\.com$/

type YouTubeInfo = {
  playerState?: number
  currentTime?: number
  duration?: number
  videoUrl?: string
  videoData?: { title?: string }
}

/**
 * Tracks page sessions, clicks, scroll depth, time on page, outbound links, downloads, site search, video and forms once analytics
 * consent is granted: `createAnalytics({ autoTracking: autoTracking() })`.
 * An object turns on only the kinds it names, unless it names none.
 */
export function autoTracking(config: AutoTrackingConfig = {}): AutoTracking {
  const { clicks, scroll, timeOnPage, pageViews, outboundClicks, downloads, siteSearch, video, forms } = config
  const named = [clicks, scroll, timeOnPage, pageViews, outboundClicks, downloads, siteSearch, video, forms].some(
    (kind) => kind != null && kind !== false,
  )
  const on = (kind: unknown) => (kind == null ? !named : kind !== false)
  const settings = <T extends object>(kind: boolean | T | undefined): Partial<T> =>
    typeof kind === 'object' ? kind : {}

  return ({ track, signal }) => {
    let pageIndex = 0
    const extensions = settings(downloads).extensions ?? DEFAULT_DOWNLOAD_EXTENSIONS
    const linkEvent = (link: HTMLAnchorElement) => {
      if (!/^https?:$/.test(link.protocol)) return undefined
      const found = /\.([a-z\d]+)$/i.exec(link.pathname)?.[1]?.toLowerCase()
      const extension = on(downloads) && found && extensions.includes(found) ? found : undefined
      const outbound = on(outboundClicks) && link.hostname !== window.location.hostname
      return extension || outbound ? { extension, outbound } : undefined
    }
    const send = (name: string, params: Record<string, unknown>) =>
      void track(name, { ...params, page_index: pageIndex, session_id: pageIndex }, { requireAnalyticsConsent: true })
    let page = new AbortController()
    signal.addEventListener('abort', () => page.abort())

    if (on(clicks)) {
      const { mode = 'all', attribute = 'data-track', selectors = DEFAULT_CLICK_SELECTORS } = settings(clicks)
      const selector = mode === 'attribute' ? `[${attribute}]` : selectors.join(', ')
      const onClick = (event: Event) => {
        const element = selector ? (event.target as Element | null)?.closest(selector) : null
        if (!(element instanceof HTMLElement)) return
        const link = element.closest('a[href]')
        if (link instanceof HTMLAnchorElement && !element.hasAttribute(attribute) && linkEvent(link)) return
        send(getNames().autoTrackingEvents.uiClick, {
          ui_target: element.getAttribute(attribute) || element.getAttribute('aria-label') || 'unknown',
          ui_element: element.tagName.toLowerCase(),
          ui_id: element.id || undefined,
          path: window.location.pathname,
        })
      }
      window.addEventListener('click', onClick, { signal })
    }

    if (on(outboundClicks) || on(downloads)) {
      const onLinkClick = (event: Event) => {
        const link = (event.target as Element | null)?.closest('a[href]')
        if (!(link instanceof HTMLAnchorElement)) return
        const params = { link_url: link.href, link_id: link.id || undefined }
        const { extension, outbound } = linkEvent(link) ?? {}
        if (extension) {
          send(getNames().autoTrackingEvents.fileDownload, {
            ...params,
            file_name: link.pathname,
            file_extension: extension,
          })
        }
        if (outbound) send(getNames().autoTrackingEvents.outboundClick, { ...params, link_domain: link.hostname })
      }
      window.addEventListener('click', onLinkClick, { signal })
    }

    return () => {
      page.abort()
      page = new AbortController()
      const pageSignal = page.signal
      pageIndex += 1

      if (pageViews) send(getNames().autoTrackingEvents.pageSessionStart, {})

      if (on(siteSearch)) {
        const query = new URLSearchParams(window.location.search)
        const term = (settings(siteSearch).params ?? DEFAULT_SEARCH_PARAMS).map((name) => query.get(name)).find(Boolean)
        if (term) send(getNames().autoTrackingEvents.siteSearch, { search_term: term })
      }

      if (on(forms)) {
        const started = new WeakSet<HTMLFormElement>()
        const formParams = (form: HTMLFormElement) => ({
          form_id: form.getAttribute('id') || undefined,
          form_name: form.getAttribute('name') || undefined,
          form_destination: new URL(form.getAttribute('action') ?? '', document.baseURI).href,
        })
        const onFocus = (event: Event) => {
          const form = event.target instanceof Element ? event.target.closest('form') : null
          if (!form || started.has(form)) return
          started.add(form)
          send(getNames().autoTrackingEvents.formStart, formParams(form))
        }
        const onSubmit = (event: Event) => {
          if (event.target instanceof HTMLFormElement)
            send(getNames().autoTrackingEvents.formSubmit, formParams(event.target))
        }
        document.addEventListener('focusin', onFocus, { signal: pageSignal })
        document.addEventListener('submit', onSubmit, { signal: pageSignal })
      }

      if (on(video)) {
        const sent = new WeakMap<object, Set<string | number>>()
        const report = (
          player: object,
          state: 'playing' | 'ended' | undefined,
          current: number,
          duration: number,
          details: { video_provider: string; video_url?: string; video_title?: string },
        ) => {
          const seen = sent.get(player) ?? new Set()
          sent.set(player, seen)
          const params = {
            ...details,
            video_current_time: Math.round(current),
            video_duration: Number.isFinite(duration) ? Math.round(duration) : undefined,
          }
          const once = (key: string | number, name: string, extra?: object) => {
            if (seen.has(key)) return
            seen.add(key)
            send(name, { ...params, ...extra })
          }
          const names = getNames().autoTrackingEvents
          if (state === 'playing') once('start', names.videoStart)
          if (!seen.has('start')) return
          for (const percent of VIDEO_PERCENTS) {
            if (duration > 0 && (current / duration) * 100 >= percent) {
              once(percent, names.videoProgress, { video_percent: percent })
            }
          }
          if (state === 'ended') once('end', names.videoComplete)
        }
        const onMedia = (event: Event) => {
          const element = event.target
          if (!(element instanceof HTMLVideoElement)) return
          const state =
            event.type === 'ended' ? 'ended' : event.type === 'play' || !element.paused ? 'playing' : undefined
          report(element, state, element.currentTime, element.duration, {
            video_provider: 'html5',
            video_url: element.currentSrc,
            video_title: element.title || undefined,
          })
        }
        for (const type of ['play', 'timeupdate', 'ended']) {
          document.addEventListener(type, onMedia, { capture: true, signal: pageSignal })
        }

        const youtube = new WeakMap<object, YouTubeInfo>()
        const listen = (frame: EventTarget | null) => {
          if (!(frame instanceof HTMLIFrameElement) || !frame.src) return
          const src = new URL(frame.src)
          if (!YOUTUBE_ORIGIN.test(src.origin) || src.searchParams.get('enablejsapi') !== '1') return
          // The message holds no data; '*' avoids a console error when the frame has not navigated yet.
          frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', channel: 'widget' }), '*')
        }
        const onMessage = (event: MessageEvent) => {
          if (!event.source || !YOUTUBE_ORIGIN.test(event.origin) || typeof event.data !== 'string') return
          let message: { event?: string; info?: YouTubeInfo }
          try {
            message = JSON.parse(event.data) as typeof message
          } catch {
            return
          }
          if (message.event !== 'infoDelivery' && message.event !== 'initialDelivery') return
          const info = { ...youtube.get(event.source), ...message.info }
          youtube.set(event.source, info)
          const state = info.playerState === 1 ? 'playing' : info.playerState === 0 ? 'ended' : undefined
          report(event.source, state, info.currentTime ?? 0, info.duration ?? 0, {
            video_provider: 'youtube',
            video_url: info.videoUrl,
            video_title: info.videoData?.title,
          })
        }
        window.addEventListener('message', onMessage, { signal: pageSignal })
        document.addEventListener('load', (event) => listen(event.target), { capture: true, signal: pageSignal })
        document.querySelectorAll('iframe').forEach(listen)
      }

      if (on(scroll)) {
        const thresholds = (settings(scroll).thresholds ?? DEFAULT_SCROLL_THRESHOLDS)
          .filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
          .sort((a, b) => a - b)
        const emitted = new Set<number>()
        const onScroll = () => {
          const doc = document.documentElement
          const total = doc.scrollHeight - window.innerHeight
          if (total <= 0) return
          const depth = Math.round(Math.min(1, (window.scrollY || doc.scrollTop) / total) * 100)
          for (const threshold of thresholds) {
            // Scroll positions rarely land exactly on the bottom, so 100 fires from 95.
            if (depth < (threshold === 100 ? 95 : threshold) || emitted.has(threshold)) continue
            emitted.add(threshold)
            send(getNames().autoTrackingEvents.scrollDepth, { depth: threshold })
          }
          if (emitted.size === thresholds.length) window.removeEventListener('scroll', onScroll)
        }
        window.addEventListener('scroll', onScroll, { passive: true, signal: pageSignal })
      }

      if (on(timeOnPage)) {
        for (const seconds of settings(timeOnPage).intervals ?? DEFAULT_TIME_INTERVALS) {
          if (!Number.isFinite(seconds) || seconds <= 0) continue
          const handle = window.setTimeout(
            () => send(getNames().autoTrackingEvents.timeOnPage, { seconds }),
            seconds * 1000,
          )
          pageSignal.addEventListener('abort', () => window.clearTimeout(handle))
        }
      }
    }
  }
}
