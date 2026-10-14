# Publishing and Releases

The package publishes to [npmjs.com](https://www.npmjs.com/package/consentlayer)
from GitHub Actions with npm trusted publishing: no npm token is stored.
Versions and the changelog are managed with [Changesets](https://changesets.dev).

## One-Time Setup

1. Make the repository public. npm adds provenance only for public
   repositories.
2. In the repository settings → Environments, create `npm` with yourself as a
   required reviewer. The publish job waits there for your approval.
3. In the repository settings → Actions → General, allow GitHub Actions to
   create and approve pull requests, so the release pull request can be opened.
4. On npmjs.com, open the package settings → Trusted publishing → GitHub
   Actions, and enter owner `nicolopadovan`, repository
   `analytics-consent-manager-npm`, workflow `publish-package.yml` and
   environment `npm`.

## Release Steps

1. Each pull request that changes the package adds a changeset
   (`pnpm changeset`).
2. On `main`, the Release workflow
   ([`publish-package.yml`](../.github/workflows/publish-package.yml)) opens or
   updates a "Release consentlayer" pull request that bumps the version and
   writes the changelog from the pending changesets.
3. Merging that pull request runs the Release workflow again. It sees a version
   that isn't on npm yet, waits for approval in the `npm` environment, runs
   the checks, publishes with `npm publish`, and pushes the tag
   `consentlayer@<version>`.

A version set by hand in `package.json` is published the same way once it
reaches `main`.

## Prereleases

The repository is in Changesets prerelease mode (`.changeset/pre.json`, tag
`rc`), so releases are numbered `1.0.0-rc.N`. The workflow publishes any
version with a prerelease suffix under the `next` dist-tag, so
`npm install consentlayer` keeps getting the latest stable version. To
release 1.0.0, run `pnpm changeset pre exit` and merge; the next release
pull request bumps to `1.0.0`, which is published under `latest`.

## When The Workflow Fails

Check:

- `pnpm-lock.yaml` is committed
- the publish job still has `id-token: write` permission
- npmjs.com lists this repository, `publish-package.yml` and the `npm`
  environment as the package's trusted publisher
