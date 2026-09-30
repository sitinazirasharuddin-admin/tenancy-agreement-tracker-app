# Project backup — 30 September 2026

The repository root is the current application source. Its Git history preserves previous committed versions. This backup also retains materials previously stored outside the repository:

- `design-inputs/stitch_tenancy_agreement_tracker.zip`: original supplied Stitch reference, including design documents, HTML, screenshots and property photos.
- `deliverables/team-workspace-mockups.html`: self-contained Candy mockups.
- `deliverables/tenancy-dashboard.png`: earlier dashboard screenshot.
- `deliverables/START-HERE.txt`: original handover snapshot; historical instructions may be outdated.
- `skills/tenancy-agreement-tracker/SKILL.md`: saved reusable project skill snapshot.
- `historical/tenancy-tracker-source.zip`: earlier source export; use the repository root for current code.
- `manifest.json`: SHA-256 checksums for these backup materials.

## Current state

Manual Tenant and Unit entry in New TA was deployed in `dddd89a`. The app creates or reuses related records when saving. Candy styling, team authentication, mobile navigation and guided signing/stamping workflows are present.

MCP work is unfinished. The official MCP SDK and Zod were installed, and OAuth requirements were researched. No MCP endpoint or consent UI has been implemented or enabled. Do not describe the app as connected to ChatGPT Work or Claude Cowork yet.

## Restore

1. Clone this repository and install dependencies with `npm ci` using Node 22.
2. Recover environment values from the existing Vercel project or your secret manager. `.env.example` documents variable names only.
3. Inspect the existing Supabase project before applying migrations. SQL migrations are included under `supabase/migrations`; these are schema/history, not an export of live business records.
4. Run `npm test` and `npm run build`.
5. Deploy through the existing GitHub-to-Vercel integration when authorized.

## Exclusions and limits

This repository is public. Passwords, API/service-role keys, environment files, authentication sessions, GitHub/Vercel CLI credentials, dependency folders and generated build caches are intentionally excluded. Reinstall dependencies from the committed lockfile.

This backup does not contain a live Supabase database export, auth users, storage objects, Vercel secret values, or the complete chat transcript. Private business records require a separately authorized private destination. No tenant source documents were found in the local Tenant folder at this snapshot. The source ZIP and handover are historical artifacts, not replacements for current source and documentation.
