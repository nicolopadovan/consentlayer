# Publishing and Releases

The package publishes to [npmjs.com](https://www.npmjs.com/package/consentlayer)
from GitHub Actions with npm trusted publishing: no npm token is stored.

## One-Time Setup

1. Publish the first version by hand (`npm login`, then `npm publish` in
   `packages/consentlayer` after `pnpm build`), or claim the name otherwise.
2. On npmjs.com, open the package settings → Trusted publishing → GitHub
   Actions, and enter owner `nicolopadovan`, repository
   `analytics-consent-manager-npm` and workflow `publish-package.yml`.
3. Make the repository public. npm adds provenance (a signed link from the
   tarball to the commit and workflow that built it) only for public
   repositories.

## Release Steps

1. Bump `version` in `packages/consentlayer/package.json` and move the
   `[Unreleased]` CHANGELOG entries under the new version.
2. Merge to `main`.
3. Publish a GitHub release, or run the `Publish Package` workflow.

The workflow ([`publish-package.yml`](../.github/workflows/publish-package.yml))
runs typecheck, lint, test and build, then `npm publish` with Node 24. It
publishes with `npm` rather than `pnpm` because trusted publishing needs npm
11.5.1 or later.

## When The Workflow Fails

Check:

- the package version was bumped when needed
- `pnpm-lock.yaml` is committed
- the workflow still has `id-token: write` permission
- npmjs.com lists this repository and `publish-package.yml` as the package's trusted publisher

## Versioning

Semver. The workflow publishes prereleases (`1.0.0-rc.N`) under the `next`
dist-tag, so `npm install consentlayer` keeps getting the latest stable version.
