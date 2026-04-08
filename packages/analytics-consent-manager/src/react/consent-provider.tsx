'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createConsentEngine } from '../core/consent-engine'
import { getDefaultConsentEngine } from '../core/default-runtime'
import type {
  ConsentEngine,
  ConsentEngineOptions,
  ConsentState,
} from '../core/types'

type ConsentContextValue = {
  engine: ConsentEngine
  consent: ConsentState | null
  setConsent: (consent: ConsentState) => Promise<void>
}

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined)

export type ConsentProviderProps = ConsentEngineOptions & {
  children: ReactNode
  engine?: ConsentEngine
}

export function ConsentProvider({
  children,
  engine,
  ...options
}: ConsentProviderProps) {
  const ownsRuntime = !engine
  const [runtime] = useState(() => engine ?? createConsentEngine(options))
  const consent = useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getConsent(),
    () => runtime.getConsent(),
  )

  useEffect(() => {
    void runtime.bootstrap()
    return () => {
      if (ownsRuntime) {
        runtime.destroy()
      }
    }
  }, [ownsRuntime, runtime])

  const value = useMemo<ConsentContextValue>(
    () => ({
      engine: runtime,
      consent,
      setConsent: (nextConsent) => runtime.setConsent(nextConsent),
    }),
    [consent, runtime],
  )

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value) {
    const engine = getDefaultConsentEngine()
    return {
      engine,
      consent: engine.getConsent(),
      setConsent: (consent) => engine.setConsent(consent),
    }
  }
  return value
}
