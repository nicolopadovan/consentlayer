# Publishing and Releases

The package publishes to [npmjs.com](https://www.npmjs.com/package/consentlayer)
from GitHub Actions with npm trusted publishing: no npm token is stored.
Versions and the changelog are managed with [Changesets](https://changesets.dev).

## One-Time Setup

1. Rename the repository to `consentlayer`, to match the `repository` field
   in the package's `package.json`, and make it public. npm adds provenance
   only for public repositories.
2. In the repository settings → Environments, create `npm` with yourself as a
   required reviewer. The publish job waits there for your approval.
3. In the repository settings → Actions → General, allow GitHub Actions to
   create and approve pull requests, so the release pull request can be opened.
4. On npmjs.com, open the package settings → Trusted publishing → GitHub
   Actions, and enter owner `nicolopadovan`, repository
   `consentlayer`, workflow `publish-package.yml` and
   environment `npm`.
5. In the repository settings → Pages, set the source to GitHub Actions and
   the custom domain to `consentlayer.nicolopadovan.com`. At your DNS
   provider, add a `CNAME` record from `consentlayer` to
   `nicolopadovan.github.io`, with any proxy off. Then turn on Enforce HTTPS.
   In your account settings → Pages, verify `nicolopadovan.com` with the TXT
   record GitHub shows, so no other account can serve a site on its
   subdomains.

The Docs workflow deploys the documentation site on every push to `main`.

## Planning Versions

Each version has a [milestone](https://github.com/nicolopadovan/consentlayer/milestones)
with its target date, and each change in it an issue. A new request goes to
the next open milestone, never to the version being released. Roadmap items
with no target yet carry the `roadmap` label and no milestone.

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

Releases are stable versions under the `latest` dist-tag. To publish
prereleases, run `pnpm changeset pre enter <tag>` (for example `rc`) and
merge; versions then carry a suffix such as `2.0.0-rc.0`, and the workflow
publishes any version with a suffix under the `next` dist-tag, so
`npm install consentlayer` keeps getting the latest stable version. Run
`pnpm changeset pre exit` and merge to return to stable releases.

## When The Workflow Fails

Check:

- `pnpm-lock.yaml` is committed
- the publish job still has `id-token: write` permission
- npmjs.com lists this repository, `publish-package.yml` and the `npm`
  environment as the package's trusted publisher
