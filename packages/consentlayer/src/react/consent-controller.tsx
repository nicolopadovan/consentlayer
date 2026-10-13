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
import type { ConsentState } from '../core/types'
import { useConsent } from './analytics-provider'

type ConsentControllerValue = {
  ready: boolean
  error: string | null
  bannerVisible: boolean
  dialogVisible: boolean
  prefs: Pick<ConsentState, 'preferences' | 'analytics' | 'marketing'>
  setPrefs: (
    next: Pick<ConsentState, 'preferences' | 'analytics' | 'marketing'>,
  ) => void
  showBanner: () => void
  hideBanner: () => void
  openDialog: () => void
  closeDialog: () => void
  acceptAll: () => Promise<void>
  rejectNonEssential: () => Promise<void>
  savePreferences: () => Promise<void>
}

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
  const [prefs, setPrefs] = useState({
    preferences: false,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    let cancelled = false
    void engine
      .bootstrap()
      .then((bootstrappedConsent) => {
        if (cancelled) return
        if (bootstrappedConsent) {
          setPrefs({
            preferences: bootstrappedConsent.preferences,
            analytics: bootstrappedConsent.analytics,
            marketing: bootstrappedConsent.marketing,
          })
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
  }, [autoShowBanner, engine])

  useEffect(() => {
    if (!consent) return
    setPrefs({
      preferences: consent.preferences,
      analytics: consent.analytics,
      marketing: consent.marketing,
    })
  }, [consent])

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
      acceptAll: () =>
        applyAndClose({
          preferences: true,
          analytics: true,
          marketing: true,
        }),
      rejectNonEssential: () =>
        applyAndClose({
          preferences: false,
          analytics: false,
          marketing: false,
        }),
      savePreferences: () =>
        applyAndClose({
          preferences: prefs.preferences,
          analytics: prefs.analytics,
          marketing: prefs.marketing,
        }),
    }),
    [applyAndClose, bannerVisible, dialogVisible, error, prefs, ready],
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
