import { createFileRoute } from '@tanstack/react-router'
import { useAnalytics, useConsent } from 'consentlayer/react'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Home | ConsentLayer with TanStack Start' }] }),
  component: Home,
})

function Home() {
  const analytics = useAnalytics()
  const { consent } = useConsent()

  return (
    <section>
      <h1>ConsentLayer with TanStack Start</h1>
      <button type="button" onClick={() => void analytics.track('sign_up', { method: 'email' })}>
        Track sign_up
      </button>
      <pre>{JSON.stringify(consent, null, 2)}</pre>
    </section>
  )
}
