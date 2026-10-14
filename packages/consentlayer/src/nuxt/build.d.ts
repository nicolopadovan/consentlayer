declare module '#build/consentlayer.config.mjs' {
  const config: () => import('../core/create-analytics').AnalyticsOptions
  export default config
}
declare module '#build/consentlayer.options.mjs' {
  const options: import('./index').ModuleOptions
  export default options
}
