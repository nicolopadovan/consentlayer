---
'consentlayer': minor
---

`tcf()` no longer stores the denied state it reads while the CMP shows its interface, before the visitor has chosen. Consent adapters can answer `{ consent, provisional: true }` from `bootstrap()` for such a state: the engine applies it but does not store it. The new `ConsentBootstrapAnswer` type describes the answer.
