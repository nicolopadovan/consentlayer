---
title: Contributing and support
description: Get help, report a bug or a vulnerability, and contribute code or documentation to ConsentLayer.
---

ConsentLayer is open source under the [MIT License](https://github.com/nicolopadovan/analytics-consent-manager-npm/blob/main/LICENSE).
Questions, bug reports, documentation fixes and pull requests are welcome.

## Get help

Read [Troubleshooting](/guides/troubleshooting/), then search the
[issues](https://github.com/nicolopadovan/analytics-consent-manager-npm/issues) and open a new one if yours isn't there. Include:

- the `consentlayer` version, your framework and its version;
- the providers you use and their options, without secrets;
- the consent state you expected and what you observed;
- the output with `debug: true`, and the steps to reproduce.

ConsentLayer can't give legal advice; see the [legal notice](/guides/legal/).

## Report a vulnerability

Report vulnerabilities privately, through
[GitHub's private vulnerability reporting](https://github.com/nicolopadovan/analytics-consent-manager-npm/security/advisories/new),
never in a public issue. Examples are a provider loading or receiving data
without the consent it requires, personal data reaching a provider despite
the documented rules, or a forged event or consent cookie accepted by the
server. Security fixes are released for the latest minor version. See the
[security policy](https://github.com/nicolopadovan/analytics-consent-manager-npm/blob/main/SECURITY.md).

Never put a live token, such as a Meta Conversions API access token, in an
issue or pull request. If one leaks, rotate it with the vendor first.

## Contribute code

For a new feature or a change to the public API, open an issue first so the
design can be agreed before you write the code. You need Node.js 24 and
pnpm 10:

```bash
pnpm install
pnpm turbo run typecheck lint test build
pnpm --filter consentlayer check:package
```

CI runs the same checks on every pull request. `check:package` validates the
published package and checks each entry point against its size budget; a
feature that adds code may raise a budget, as long as the pull request says
so. Lint warnings fail the build.

A pull request should make one change, with tests for the behavior it adds or
fixes, keep providers from loading or receiving data before their consent
requirement is met, and update these docs when public behavior changes. When
the published package changes, run `pnpm changeset` to add a changeset, which
becomes the change's entry in the [changelog](/guides/changelog/). The
[contributing guide](https://github.com/nicolopadovan/analytics-consent-manager-npm/blob/main/CONTRIBUTING.md) describes the repository
layout and how to run the examples and the docs locally.

## Code of Conduct

Everyone taking part in the project's issues, pull requests and discussions
follows the [Code of Conduct](https://github.com/nicolopadovan/analytics-consent-manager-npm/blob/main/CODE_OF_CONDUCT.md), which adopts
the Contributor Covenant 2.1.

By contributing, you agree that your contributions are licensed under the MIT
License.
