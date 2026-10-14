import { useAnalytics } from 'consentlayer/solidstart'
import { ConsentState } from '~/lib/ConsentState'

export default function Home() {
  const analytics = useAnalytics()

  return (
    <section>
      <h1>ConsentLayer with SolidStart</h1>
      <button type="button" onClick={() => void analytics.track('sign_up', { method: 'email' })}>
        Track sign_up
      </button>
      <ConsentState />
    </section>
  )
}
