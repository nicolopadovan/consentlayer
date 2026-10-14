import { useConsentController } from 'consentlayer/solidstart'
import { Show } from 'solid-js'

export function CookieSettingsButton() {
  const consent = useConsentController()

  return (
    <Show when={consent.ready && !consent.bannerVisible}>
      <button type="button" onClick={() => consent.openDialog()}>
        Cookie settings
      </button>
    </Show>
  )
}
