# AGENTS.md

Instructions for AI coding agents working in this repository. People contributing should read
[CONTRIBUTING.md](./CONTRIBUTING.md); everything there applies to agents too.

## Repository

A pnpm and Turborepo monorepo. Use Node.js 24 and the pnpm version in `packageManager`.

- `packages/consentlayer`: the published package. Source in `src`, Vitest tests in `test`, build with tsup.
- `apps/docs`: the documentation site, Astro Starlight. Pages are in `src/content/docs`, the sidebar in
  `astro.config.mjs`.
- `apps/example-*`: one example application per framework.
- `docs`: maintainer notes, including [publishing and releases](./docs/publishing-and-releases.md).

The published docs are at https://consentlayer.vercel.app, and as Markdown for agents at
https://consentlayer.vercel.app/llms-full.txt.

## Commands

```bash
pnpm install
pnpm format                      # Prettier, writes changes
pnpm format:check
pnpm knip                        # unused files, exports and dependencies
pnpm turbo run typecheck lint test build
pnpm --filter consentlayer check:package   # publint, attw, size-limit, es-check
pnpm --filter consentlayer test test/providers.test.ts
pnpm --filter docs dev
```

Before you finish, run every check CI runs: `format:check`, `knip`, the turbo command and `check:package`. Lint
warnings fail the build.

## Rules

- Consent comes first. No provider loads a script or receives data before its consent requirement is met, unless
  an option the user sets says so. Every change to a provider, adapter or server destination needs a test that
  proves it.
- The package has no runtime dependencies. Vendor SDKs are optional peer dependencies, loaded with dynamic
  `import()`.
- Browser code must run in the browsers in `browserslist` in `packages/consentlayer/package.json`; ESLint and
  es-check enforce it. Server code uses only `fetch` and Web Crypto, so it runs on edge runtimes.
- Never trim code to pass a size budget. A feature that adds code raises its budget in
  `packages/consentlayer/.size-limit.js`; say so in the pull request.
- Match the surrounding code. Write no comments that restate the code; comment only external constraints.
- A new entry point needs all of: the tsup `entry` in `tsup.config.ts`, the `exports` field in `package.json`, a
  size budget, a docs page and its sidebar entry. A new provider or adapter is also added to the script-tag build
  in `src/global`.
- Add a changeset (`pnpm changeset`) when the published package changes.

## Docs

- Write in the tone of the Next.js docs: complete, professional sentences, technical and precise. Verify every
  fact against the source in `packages/consentlayer/src`. Put extra depth in `<details>`.
- Name the product **ConsentLayer** in prose and `consentlayer` only in code and commands.
- Never say a setup complies with a law. ConsentLayer has not been legally reviewed; link to
  [the legal notice](./apps/docs/src/content/docs/guides/legal.md) instead.
- Update the docs, the API reference (`reference/api.md`) and the changeset when public behavior, options or
  install steps change.
