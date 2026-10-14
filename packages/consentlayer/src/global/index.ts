import { createGlobal, readConfig } from './config'

const input = window.ConsentLayer
if (!input || !('controller' in input)) {
  window.ConsentLayer = { ...createGlobal(readConfig(input, document.currentScript)), banner: input?.banner }
  dispatchEvent(new Event('consentlayer:ready'))
}
