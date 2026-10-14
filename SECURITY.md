# Security policy

## Reporting a vulnerability

Report vulnerabilities privately, through
[GitHub's private vulnerability reporting](https://github.com/nicolopadovan/consentlayer/security/advisories/new),
not in a public issue. Include the affected version, the steps to reproduce
and the impact you expect.

Examples of what to report:

- A provider loading or receiving data without the consent it requires.
- Personal data, such as an email address or phone number, reaching a
  provider or the server despite the documented rules.
- Forged or replayed events accepted by `createAnalyticsHandler()`, or a
  forged consent cookie accepted by the server.
- Script injection through ConsentLayer's options or the script-tag build.

## Supported versions

Security fixes are released for the latest minor version of the current major
version.

## Secrets

Never put live tokens, such as a Meta Conversions API access token or a GA4
API secret, in an issue, pull request or screenshot. If one leaks, rotate it
with the vendor first.
