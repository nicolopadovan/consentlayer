import { Component, input } from '@angular/core'
import type { ConsentCategory } from 'consentlayer'
import { injectConsentController } from 'consentlayer/angular'

const labels: Record<ConsentCategory, { label: string; description: string }> = {
  preferences: {
    label: 'Preferences',
    description: 'Remember settings such as language or region.',
  },
  analytics: {
    label: 'Analytics',
    description: 'Help us understand how the site is used.',
  },
  marketing: {
    label: 'Marketing',
    description: 'Measure our ads and show relevant ones on other sites.',
  },
}

@Component({
  selector: 'app-consent-banner',
  template: `
    @if (consent.ready()) {
      @if (consent.dialogVisible()) {
        <div class="consent-dialog" role="dialog" aria-labelledby="consent-dialog-title">
          <h2 id="consent-dialog-title">Cookie settings</h2>
          <label>
            <input type="checkbox" checked disabled />
            <span><strong>Necessary</strong> Needed for the site to work, such as remembering this choice. Always on.</span>
          </label>
          @for (key of consent.categories(); track key) {
            <label>
              <input type="checkbox" [checked]="consent.prefs()[key]" (change)="toggle(key, $event)" />
              <span
                ><strong>{{ labels[key].label }}</strong> {{ labels[key].description }}</span
              >
            </label>
          }
          <div class="consent-actions">
            <button type="button" (click)="consent.closeDialog()">Close</button>
            <button type="button" class="primary" (click)="consent.savePreferences()">Save</button>
          </div>
        </div>
      } @else if (consent.bannerVisible()) {
        <div class="consent-banner" role="dialog" aria-labelledby="consent-banner-title">
          <h2 id="consent-banner-title">Cookies</h2>
          <p>
            We use cookies to run this site and, with your consent, for preferences, analytics and marketing.
            @if (privacyPolicyUrl()) {
              <a [href]="privacyPolicyUrl()">Privacy policy</a>
            }
          </p>
          <div class="consent-actions">
            <button type="button" (click)="consent.rejectNonEssential()">Reject non-essential</button>
            <button type="button" (click)="consent.openDialog()">Customize</button>
            <button type="button" class="primary" (click)="consent.acceptAll()">Accept all</button>
          </div>
        </div>
      }
    }
  `,
})
export class ConsentBanner {
  readonly privacyPolicyUrl = input<string>()
  protected readonly consent = injectConsentController()
  protected readonly labels = labels

  protected toggle(key: ConsentCategory, event: Event): void {
    this.consent.setPrefs({
      ...this.consent.prefs(),
      [key]: (event.target as HTMLInputElement).checked,
    })
  }
}
