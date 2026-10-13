# Contributing

## Repo Structure

- `packages/consentlayer`: publishable package source
- `apps/example-next`: working consumer app used as the reference integration
- `docs`: operational and integration documentation rendered by GitHub

## Local Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Use the example app when changing runtime behavior that affects consumers:

```bash
pnpm --filter example-next dev
```

## Change Expectations

- Keep package code framework-agnostic unless it belongs in the React or server entrypoints.
- Preserve consent-first semantics.
- Keep Meta dispatch gated by marketing consent.
- Update the docs site in [`apps/docs`](./apps/docs) when public behavior, environment variables, or install steps change.
- Use the example app as the canonical integration reference for new features.

## Release Process

1. Update the version in `packages/consentlayer/package.json`.
2. Verify `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build`.
3. Merge to `main`.
4. Run the `Publish Package` workflow or publish a GitHub release.

## Pull Requests

Every PR should make it clear:

- what changed
- whether consumer-facing docs changed
- whether package versioning needs a bump
- how the change was verified
