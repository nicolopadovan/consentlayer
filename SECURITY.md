# Security Policy

This repository is private and intended for internal distribution, but package credentials and analytics secrets still need explicit handling.

## Reporting

If you find a security issue:

- do not include secrets in commits, PRs, or screenshots
- do not paste live tokens into issues
- report the issue directly in this private repository to maintainers
- for credential leaks, rotate the affected secret immediately

## Common Sensitive Values

- `META_TOKEN`
- `FACEBOOK_TEST_EVENT_CODE`
- `GA4_API_SECRET`
- GitHub Packages PATs used for local install or local publish

## Scope

Security-sensitive areas in this repo include:

- server-side tracking helpers
- consent enforcement and provider gating
- local and CI package publishing configuration
- example app route handlers under `apps/example-next/app/api`

## Response Expectations

Maintainers should triage security reports before normal feature work and prioritize:

1. credential exposure
2. consent bypass
3. server-side event forgery or origin bypass
4. package publishing and access-control mistakes
