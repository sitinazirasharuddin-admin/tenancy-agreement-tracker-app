# Workflow usability update — 30 September 2026

- Workflow buttons open the agreement editor with the intended next status when signing/stamping/payment details are missing. The first missing text/date field receives focus, and a guidance message explains what to complete.
- Guided submissions validate missing details before saving. Completion still requires confirmation and the existing database checks; zero stamping fees and N/A payment are supported.
- The selected team is remembered per signed-in user. It is restored only when the current team membership query still includes that team; Switch team clears the preference. No credentials or business records are stored in this preference.
- A successful password update removes the recovery and auth_error URL parameters, preserving unrelated query parameters. This prevents a refresh from reopening the password form.

Validation: production build and all five tests passed. Browser verified remembered team after reload and guided stamping with a zero fee at phone width against the disposable local database. No live passwords or business records were changed to test this release.

Remaining known limitations: simultaneous full-record edits can overwrite another staff member's changes; team creation and optional starter-property insertion are separate requests. This update does not claim to fix those issues.
