# Installation and Access

## Prerequisites

- access to the private GitHub repository
- a classic GitHub PAT with `read:packages`
- `pnpm`, `npm`, or `yarn`

GitHub Packages local installs do not use the repo `GITHUB_TOKEN`. Each teammate needs their own PAT for local installs.

## User-Level npm Configuration

Add this to `~/.npmrc`:

```ini
@nicolopadovan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_CLASSIC_PAT
always-auth=true
```

## Install

```bash
pnpm add @nicolopadovan/analytics-consent-manager
```

Subpath entrypoints are available under the same package:

- `@nicolopadovan/analytics-consent-manager`
- `@nicolopadovan/analytics-consent-manager/react`
- `@nicolopadovan/analytics-consent-manager/server`
- `@nicolopadovan/analytics-consent-manager/ui`
- `@nicolopadovan/analytics-consent-manager/providers/*`

## CI Install

For CI environments outside GitHub Actions, inject a token with `read:packages` into the job and write the same scoped registry config before `pnpm install`.

## Common Failure Modes

- `404` or package not found: the user is missing package or repo access
- auth failure: the PAT is missing `read:packages`
- install works in Actions but not locally: the user assumed their `gh auth` session was enough; it is not
