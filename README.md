# Analytics Consent Manager

Private monorepo for the `@nicolopadovan/analytics-consent-manager` package and its example Next.js consumer.

## Private publishing target

The package is configured for GitHub Packages and is intended to stay private.

- Package name: `@nicolopadovan/analytics-consent-manager`
- Registry: `https://npm.pkg.github.com`
- Repository: `https://github.com/nicolopadovan/analytics-consent-manager-npm`

## Publish from GitHub Actions

The repo includes a workflow at `.github/workflows/publish-package.yml` that publishes the package with the repository `GITHUB_TOKEN`.

Recommended flow:

1. Bump the package version in `packages/analytics-consent-manager/package.json`.
2. Push to `main`.
3. Create a GitHub release or run the `Publish Package` workflow manually.

## Install for teammates

GitHub Packages npm auth currently requires a classic GitHub personal access token for local installs.

Required scope:

- `read:packages`

If the package inherits permissions from the private repository, the user also needs read access to the repository.

User-level `~/.npmrc` example:

```ini
@nicolopadovan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_CLASSIC_PAT
always-auth=true
```

Install command:

```bash
pnpm add @nicolopadovan/analytics-consent-manager
```

## Local publishing

For local publishes, use a classic PAT with:

- `write:packages`
- `read:packages`

Add it to your user-level `~/.npmrc`:

```ini
@nicolopadovan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_CLASSIC_PAT
always-auth=true
```

Then run:

```bash
pnpm publish:package
```

## Notes

- The committed `.npmrc` only pins the `@nicolopadovan` scope to GitHub Packages and does not store a secret.
- Your current `gh auth` login is useful for repository operations, but GitHub’s npm registry still requires package scopes for local install/publish tokens.
