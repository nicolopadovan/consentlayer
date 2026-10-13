'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { withLegacy } from '../core/names'
import type { ConsentCategory, ConsentState } from '../core/types'
import { useConsent } from './analytics-provider'

type ConsentControllerValue = {
  ready: boolean
  error: string | null
  bannerVisible: boolean
  dialogVisible: boolean
  /** The dialog's toggles, one per category in `analytics.consent.categories`. */
  prefs: Prefs
  setPrefs: (next: Prefs) => void
  showBanner: () => void
  hideBanner: () => void
  openDialog: () => void
  closeDialog: () => void
  acceptAll: () => Promise<void>
  rejectNonEssential: () => Promise<void>
  savePreferences: () => Promise<void>
}

type Prefs = Record<ConsentCategory, boolean>

const ConsentControllerContext = createContext<
  ConsentControllerValue | undefined
>(undefined)

export type ConsentControllerProviderProps = {
  children: ReactNode
  autoShowBanner?: boolean
  /** Defaults to the configured name (plus `ACM_openConsent` with `names.legacy`). */
  openConsentGlobalKey?: string
}

export function ConsentControllerProvider({
  children,
  autoShowBanner = true,
  openConsentGlobalKey,
}: ConsentControllerProviderProps) {
  const { engine, consent, setConsent } = useConsent()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [dialogVisible, setDialogVisible] = useState(false)
  const all = useCallback(
    (granted: boolean | ((category: ConsentCategory) => boolean)) =>
      Object.fromEntries(
        engine.categories.map((category) => [
          category,
          typeof granted === 'function' ? granted(category) : granted,
        ]),
      ) as Prefs,
    [engine],
  )
  const [prefs, setPrefs] = useState(() => all(false))

  useEffect(() => {
    let cancelled = false
    void engine
      .bootstrap()
      .then((bootstrappedConsent) => {
        if (cancelled) return
        if (bootstrappedConsent) {
          setPrefs(all((category) => bootstrappedConsent[category]))
          setBannerVisible(false)
        } else {
          setBannerVisible(autoShowBanner)
        }
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(String(nextError))
        setBannerVisible(autoShowBanner)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [all, autoShowBanner, engine])

  useEffect(() => {
    if (!consent) return
    setPrefs(all((category) => consent[category]))
  }, [all, consent])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const keys = openConsentGlobalKey
      ? [openConsentGlobalKey]
      : withLegacy((names) => names.openConsentGlobalKey)
    for (const key of keys) {
      ;(window as unknown as Record<string, unknown>)[key] = () =>
        setDialogVisible(true)
    }
  }, [openConsentGlobalKey])

  const applyAndClose = useCallback(async (nextConsent: ConsentState) => {
    await setConsent(nextConsent)
    setBannerVisible(false)
    setDialogVisible(false)
  }, [setConsent])

  const value = useMemo<ConsentControllerValue>(
    () => ({
      ready,
      error,
      bannerVisible,
      dialogVisible,
      prefs,
      setPrefs,
      showBanner: () => setBannerVisible(true),
      hideBanner: () => setBannerVisible(false),
      openDialog: () => setDialogVisible(true),
      closeDialog: () => setDialogVisible(false),
      acceptAll: () => applyAndClose(all(true)),
      rejectNonEssential: () => applyAndClose(all(false)),
      savePreferences: () => applyAndClose(all((category) => prefs[category])),
    }),
    [all, applyAndClose, bannerVisible, dialogVisible, error, prefs, ready],
  )

  return (
    <ConsentControllerContext.Provider value={value}>
      {children}
    </ConsentControllerContext.Provider>
  )
}

/** State and actions for building your own consent UI. */
export function useConsentController(): ConsentControllerValue {
  const value = useContext(ConsentControllerContext)
  if (!value) {
    throw new Error(
      'useConsentController must be used within AnalyticsProvider',
    )
  }
  return value
}
