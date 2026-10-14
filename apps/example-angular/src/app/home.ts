import { JsonPipe } from '@angular/common'
import { Component } from '@angular/core'
import { injectAnalytics, injectConsent } from 'consentlayer/angular'

@Component({
  selector: 'app-home',
  imports: [JsonPipe],
  template: `
    <section>
      <h1>ConsentLayer with Angular</h1>
      <button type="button" (click)="analytics.track('sign_up', { method: 'email' })">Track sign_up</button>
      <pre>{{ consent() | json }}</pre>
    </section>
  `,
})
export class Home {
  protected readonly analytics = injectAnalytics()
  protected readonly consent = injectConsent().consent
}
