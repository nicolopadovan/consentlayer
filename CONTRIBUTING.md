# Contributing

Thanks for helping improve ConsentLayer. Bug reports, documentation fixes and
pull requests are welcome. For a new feature or a change to the public API,
open an issue first so the design can be agreed before you write the code.

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE), and to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Repository layout

- [`packages/consentlayer`](./packages/consentlayer): the npm package.
- [`apps/docs`](./apps/docs): the documentation site, built with Astro Starlight.
- `apps/example-*`: one example application per framework: Next.js, Nuxt,
  SvelteKit, SolidStart, Angular, and plain HTML with the script tag.

## Setup

You need Node.js 24 and pnpm 10.

```bash
pnpm install
pnpm turbo run typecheck lint test build
```

To run an example application or the docs locally:

```bash
pnpm --filter example-next dev
pnpm --filter docs dev
```

## Checks

CI runs these on every pull request, and they must pass:

```bash
pnpm turbo run typecheck lint test build
pnpm --filter consentlayer check:package
```

`check:package` validates the published package with publint and Are the Types
Wrong, and checks every entry point against its size budget in
[`.size-limit.js`](./packages/consentlayer/.size-limit.js). Lint warnings fail
the build. A feature that adds code may raise a budget; say so in the pull
request.

## Pull requests

- Keep each pull request to one change, with tests for the behavior it adds or
  fixes.
- Preserve consent-first behavior: no provider loads or receives data before
  its consent requirement is met, unless an option the user sets says so.
- Update the docs in [`apps/docs`](./apps/docs) when public behavior, options
  or install steps change, and add an entry to the
  [changelog](./packages/consentlayer/CHANGELOG.md).
- Describe what changed and how you verified it.

## Security

Don't report vulnerabilities in public issues; see [SECURITY.md](./SECURITY.md).
