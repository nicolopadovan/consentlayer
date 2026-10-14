let assetHost = 'https://us-assets.i.posthog.com'

/** PostHog serves its scripts from the `-assets` host of `api_host`; a reverse proxy serves them itself. */
export function setPostHogHost(apiHost = 'https://us.i.posthog.com') {
  assetHost = apiHost.replace('.i.posthog.com', '-assets.i.posthog.com').replace(/\/$/, '')
}

export const postHogAsset = (name: string) => `${assetHost}/static/${name}.js`
