# Publishing and Releases

## Registry

- package: `@nicolopadovan/analytics-consent-manager`
- registry: `https://npm.pkg.github.com`
- visibility: private

## Publish Workflow

Workflow file:

- [`.github/workflows/publish-package.yml`](../.github/workflows/publish-package.yml)

Triggers:

- manual dispatch
- GitHub release published

The workflow installs dependencies, runs package lint/test/build, and publishes with the repo `GITHUB_TOKEN`.

## Release Steps

1. update `packages/analytics-consent-manager/package.json`
2. merge to `main`
3. run `Publish Package` or create a GitHub release
4. verify the Actions run succeeded

## Local Publish

Local publish is optional. If you need it, configure a user-level `~/.npmrc` with a classic PAT that has:

- `write:packages`
- `read:packages`

Then run:

```bash
pnpm publish:package
```

## Versioning

Use semver and bump intentionally. Consumers install from GitHub Packages, so version churn is the main contract surface they will see.
