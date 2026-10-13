'use client'

import { useAnalytics } from '../react/analytics-provider'
import { useConsentController } from '../react/consent-controller'

/** Every string the consent UI renders. */
export type ConsentMessages = {
  bannerTitle: string
  bannerDescription: string
  rejectNonEssential: string
  customize: string
  acceptAll: string
  dialogTitle: string
  necessaryLabel: string
  necessaryDescription: string
  preferencesLabel: string
  preferencesDescription: string
  analyticsLabel: string
  analyticsDescription: string
  marketingLabel: string
  marketingDescription: string
  close: string
  save: string
  manage: string
  privacyPolicy: string
}

/** Overrides keyed by locale (`it`, `it-CH`, `de`…); missing strings fall back to the built-in text, then English. */
export type ConsentMessageOverrides = Record<string, Partial<ConsentMessages>>

const en: ConsentMessages = {
  bannerTitle: 'Cookie preferences',
  bannerDescription:
    'We use cookies for essential functionality and, with consent, for preferences, analytics and marketing.',
  rejectNonEssential: 'Reject non-essential',
  customize: 'Customize',
  acceptAll: 'Accept all',
  dialogTitle: 'Cookie settings',
  necessaryLabel: 'Necessary cookies',
  necessaryDescription: 'Needed for the site to work, such as remembering this choice. Always on.',
  preferencesLabel: 'Preference cookies',
  preferencesDescription: 'Remember settings such as language or region.',
  analyticsLabel: 'Analytics cookies',
  analyticsDescription: 'Help us understand how the site is used, so we can improve it.',
  marketingLabel: 'Marketing cookies',
  marketingDescription: 'Measure our ads and show you relevant ones on other sites.',
  close: 'Close',
  save: 'Save preferences',
  manage: 'Manage cookies',
  privacyPolicy: 'Privacy policy',
}

const it: ConsentMessages = {
  bannerTitle: 'Preferenze sui cookie',
  bannerDescription:
    'Usiamo i cookie per il funzionamento essenziale del sito e, con il tuo consenso, per preferenze, statistiche e marketing.',
  rejectNonEssential: 'Rifiuta i non essenziali',
  customize: 'Personalizza',
  acceptAll: 'Accetta tutti',
  dialogTitle: 'Impostazioni dei cookie',
  necessaryLabel: 'Cookie necessari',
  necessaryDescription:
    'Servono al funzionamento del sito, ad esempio per ricordare questa scelta. Sempre attivi.',
  preferencesLabel: 'Cookie di preferenza',
  preferencesDescription: 'Ricordano impostazioni come la lingua o la regione.',
  analyticsLabel: 'Cookie statistici',
  analyticsDescription: 'Ci aiutano a capire come viene usato il sito, per migliorarlo.',
  marketingLabel: 'Cookie di marketing',
  marketingDescription: 'Misurano le nostre campagne e ti mostrano annunci pertinenti su altri siti.',
  close: 'Chiudi',
  save: 'Salva preferenze',
  manage: 'Gestisci i cookie',
  privacyPolicy: 'Informativa sulla privacy',
}

export const builtInMessages: Readonly<Record<string, ConsentMessages>> = { en, it }

/** English, then the built-in language, then overrides for the language, then for the exact locale. */
export function resolveMessages(
  locale: string,
  overrides: ConsentMessageOverrides = {},
): ConsentMessages {
  const exact = locale.toLowerCase()
  const language = exact.split('-')[0] ?? exact
  const override = (key: string) =>
    Object.entries(overrides).find(([candidate]) => candidate.toLowerCase() === key)?.[1]
  return {
    ...en,
    ...builtInMessages[language],
    ...override(language),
    ...(exact === language ? {} : override(exact)),
  }
}

/** The UI only renders after mount, so reading `<html lang>` here can't cause a hydration mismatch. */
export function useConsentMessages(): { messages: ConsentMessages; privacyPolicyUrl?: string } {
  const analytics = useAnalytics()
  const { locale, messages, privacyPolicyUrl } = useConsentController()
  const resolved =
    locale ??
    analytics.locale ??
    ((typeof document === 'undefined' ? '' : document.documentElement.lang) || 'en')
  return { messages: resolveMessages(resolved, messages), privacyPolicyUrl }
}
