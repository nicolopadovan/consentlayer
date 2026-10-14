## What changed

<!-- One change per pull request. Link the issue it resolves. -->

## How you verified it

<!-- Tests added or updated, and anything you checked by hand. -->

## Checklist

- [ ] `pnpm format:check`, `pnpm knip`, `pnpm turbo run typecheck lint test build` and `pnpm --filter consentlayer check:package` pass
- [ ] No provider loads or receives data before its consent requirement is met
- [ ] The docs in `apps/docs` are updated if public behavior, options or install steps changed
- [ ] A changeset is added (`pnpm changeset`) if the published package changed
