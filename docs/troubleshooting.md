# Troubleshooting

## Package Install Fails

Check:

- the user has repository access
- the PAT has `read:packages`
- `~/.npmrc` points the `@nicolopadovan` scope to `https://npm.pkg.github.com`

## Meta Pixel Helper Shows No Pixel

Check:

- `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is set
- marketing consent has been granted
- lazy boot has had time to run if the app uses `idle` mode
- the Meta provider is registered in consumer code

## Server-Side Meta Or GA4 Events Fail

Check:

- `META_TOKEN` for Meta
- `GA4_API_SECRET` for GA4
- same-origin headers are present
- your route stays app-local and is reachable from the browser adapter

## Consent Looks Stale In The UI

Check:

- the rendered page content is inside the consent/provider tree
- the consumer uses the same engine instance for the shell and the UI
- storage is writing to `acm_consent`

## GitHub Publish Workflow Fails

Check:

- the package version was bumped when needed
- `pnpm-lock.yaml` is committed
- the workflow still has `packages: write` permission
- the publish target is still `https://npm.pkg.github.com`
