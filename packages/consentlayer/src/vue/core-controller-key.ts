import type { InjectionKey } from 'vue'
import type { ConsentController } from '../core/consent-controller'

export const CoreControllerKey: InjectionKey<ConsentController> = Symbol('consentlayer.core-controller')
