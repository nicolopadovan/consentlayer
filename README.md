# consentlayer

Consent-first analytics for React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Solid,
SolidStart, Angular, plain JavaScript and the server: one instance tracks to
GA4, Google Tag Manager, Meta Pixel, TikTok Pixel, PostHog, Sentry and more,
and loads each provider only once the visitor has agreed to its category.

**Docs: [consentlayer.nicolopadovan.com](https://consentlayer.nicolopadovan.com)**

```bash
pnpm add consentlayer
```

## Repo Layout

- [`packages/consentlayer`](./packages/consentlayer): the package
- [`apps/docs`](./apps/docs): the docs site (Astro Starlight)
- `apps/example-*`: example applications for Next.js, Nuxt, SvelteKit,
  SolidStart and Angular, and one for the script tag
- [`docs`](./docs): maintainer notes: [publishing and releases](./docs/publishing-and-releases.md) and the [v1 spec](./docs/spec-v1.md)

ConsentLayer has not been legally reviewed and is not legal advice. Whether
your implementation complies with the law where you and your visitors are is
your responsibility; see the
[legal notice](https://consentlayer.nicolopadovan.com/guides/legal/).

AI tools were used to write this repository's code,
tests and documentation. Every change goes through the same tests and CI
checks before it is released.

[MIT License](./LICENSE) · [Contributing](./CONTRIBUTING.md) · [Code of Conduct](./CODE_OF_CONDUCT.md) · [Security](./SECURITY.md) · [Support](./SUPPORT.md)
