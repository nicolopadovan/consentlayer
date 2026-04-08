# Analytics Consent Manager

Private monorepo for `@nicolopadovan/analytics-consent-manager` and its example Next.js consumer.

## Quick Links

- [Docs index](./docs/README.md)
- [Installation and access](./docs/installation-and-access.md)
- [Next.js integration](./docs/nextjs-integration.md)
- [Provider configuration](./docs/provider-configuration.md)
- [Server-side tracking](./docs/server-side-tracking.md)
- [Publishing and releases](./docs/publishing-and-releases.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Support](./SUPPORT.md)

## Package

- Package name: `@nicolopadovan/analytics-consent-manager`
- Registry: `https://npm.pkg.github.com`
- Repository: [github.com/nicolopadovan/analytics-consent-manager-npm](https://github.com/nicolopadovan/analytics-consent-manager-npm)
- Example consumer: [`apps/example-next`](./apps/example-next)

## Install

GitHub Packages local installs require a classic GitHub PAT with `read:packages`.

```ini
@nicolopadovan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_CLASSIC_PAT
always-auth=true
```

```bash
pnpm add @nicolopadovan/analytics-consent-manager
```

See [installation and access](./docs/installation-and-access.md) for the full setup.

## Repo Layout

- [`packages/analytics-consent-manager`](./packages/analytics-consent-manager): publishable package
- [`apps/example-next`](./apps/example-next): reference consumer and route examples
- [`.github/workflows/publish-package.yml`](./.github/workflows/publish-package.yml): private package publish workflow

## Publish Flow

1. Update the version in [`packages/analytics-consent-manager/package.json`](./packages/analytics-consent-manager/package.json).
2. Push to `main`.
3. Run the `Publish Package` workflow or publish a GitHub release.

Details live in [publishing and releases](./docs/publishing-and-releases.md).
