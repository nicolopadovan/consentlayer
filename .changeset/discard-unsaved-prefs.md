---
'consentlayer': patch
---

`closeDialog()` now resets `prefs` to the stored choice, so toggles a visitor changed and then closed without saving are no longer granted by a later Save.
