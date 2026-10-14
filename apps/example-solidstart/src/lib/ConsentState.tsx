import { useConsent, useConsentController } from 'consentlayer/solidstart'
import { Show } from 'solid-js'

export function ConsentState() {
  const controller = useConsentController()
  const { consent } = useConsent()

  return (
    <Show when={controller.ready}>
      <pre>{JSON.stringify(consent(), null, 2)}</pre>
    </Show>
  )
}
