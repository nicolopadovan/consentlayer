import Link from 'next/link'
import { DemoClient } from '../components/demo-client'

export default function HomePage() {
  return (
    <main className="page stack">
      <section className="panel stack">
        <p>Reusable analytics and consent package demo.</p>
        <h1>Analytics and Consent Manager</h1>
        <p>
          This app proves the package can be installed into a separate Next codebase with lazy boot, consent-first
          orchestration, optional noscript support, and app-local server tracking routes.
        </p>
        <div className="button-row">
          <Link className="button" href="/">
            Refresh same route
          </Link>
          <Link className="button secondary" href="/?from=route-change">
            Trigger route change
          </Link>
        </div>
      </section>
      <DemoClient />
    </main>
  )
}
