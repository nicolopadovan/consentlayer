import { createContext } from 'solid-js'
import type { ConsentController } from '../core/consent-controller'

export const CoreControllerContext = createContext<ConsentController>()
