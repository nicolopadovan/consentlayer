import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideClientHydration, withEventReplay } from '@angular/platform-browser'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import { provideConsentLayer, provideMetaPixelNoscript } from 'consentlayer/angular'
import { environment } from '../environments/environment'
import { analytics } from './analytics'
import { routes } from './app.routes'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    provideConsentLayer({ analytics }),
    provideMetaPixelNoscript({
      pixelId: environment.facebookPixelId,
      enabled: environment.facebookPixelNoscript,
    }),
  ],
}
