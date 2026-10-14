import { Component } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'
import { injectConsentController } from 'consentlayer/angular'
import { ConsentBanner } from './consent-banner'

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, ConsentBanner],
  template: `
    <main>
      <nav>
        <a routerLink="/">Home</a> ·
        <a routerLink="/shop" [queryParams]="{ page: 2 }">Shop</a>
      </nav>
      <router-outlet />
      <app-consent-banner privacyPolicyUrl="/privacy" />
      @if (consent.ready() && !consent.bannerVisible()) {
        <button type="button" (click)="consent.openDialog()">Cookie settings</button>
      }
    </main>
  `,
})
export class App {
  protected readonly consent = injectConsentController()
}
