---
name: tenancy-agreement-tracker
description: Operate, troubleshoot, or develop Nazira's existing Tenancy Agreement Tracker, including private team access, agreements, property folders, submission tracking and yearly rental rates. Use for this app, not general tenancy drafting or legal advice.
---

# Tenancy Agreement Tracker

## Locate the existing project
- Live app: https://tenancy-agreement-tracker-app.vercel.app/
- GitHub: https://github.com/sitinazirasharuddin-admin/tenancy-agreement-tracker-app
- Checkout: `C:/Users/nazira/Documents/Codex/2026-09-30/clone-https-github-com-sitinazirasharuddin-admin/work/tenancy-agreement-tracker-app`
- Business folder: `C:/Users/nazira/OneDrive - Selangor Properties Sdn Bhd/Documents/02 DATA/Tenant`
- User skill archive: `C:/Users/nazira/OneDrive - Selangor Properties Sdn Bhd/Documents/04 SKILLS`
- Stack: Next.js App Router, TypeScript, Supabase PostgreSQL/Auth and Vercel. Supabase project `tkuloxeyzpzldgkqqrzy`; Vercel scope `leasing2`.

These are last-known locations, not evidence of current health or authentication. Inspect the checkout and Git status before changing it. Read AGENTS.md and relevant docs. Later user decisions below supersede the original demo-first PRD. Use the language requested by the user and simple operating steps.

## Preserve the user's app decisions
- One active **Leasing Team** workspace; do not create duplicate teams to work around errors.
- Candy appearance: pink/purple, rounded cards, property photos and responsive mobile navigation.
- Properties are folders: open a property to see its units and related tenants/agreements. The standalone Tenants navigation was removed.
- New TA accepts manually entered tenant and unit names, reusing or creating scoped records. Property remains selected from existing properties.
- Actions automatically lists the same agreements as the dashboard. Its submission-completed checkbox is independent of the agreement's workflow status; do not require duplicate data entry.
- Stamping due date = stamping submission date + configurable calendar days, default **14**. No submission date means no due date. This is the user's operational rule, not a claim about statutory deadlines. Display submission date and bold due date.
- Rental fields are monthly RM rates for **Year 1, Year 2 and Year 3**, not annual totals. `monthly_rental` remains Year 1; `monthly_rental_year_2` and `monthly_rental_year_3` are optional, non-negative numeric values. Preserve existing Year 1 values. `total_square_feet` stores optional non-negative floor area. Include these in New/Edit, details, Actions details and CSV.

## Registration and team access
- User reversed invitation-only registration on 6 November 2026. Migration 0010 removes the signup invitation trigger and separate admin approval. Anyone can register, confirm their email and create a private workspace.
- Registration alone never grants access to the existing Leasing Team. Its records remain protected by team membership RLS.
- Admins can invite staff to their existing team; a confirmed user with the matching email can accept a valid invitation directly as a member, without further approval. Existing pending applicants can accept a still-valid code; expired codes need replacement.
- Members can add/edit business records; admins manage members/invitations and delete business records.
- Anonymous business data access and public demo routes stay closed. Do not confuse open signup with public company data.
- Invitation links are shared manually; creating one does not send an email. Do not send messages without explicit authorization.

## Implementation map
- `components/team-workspace.tsx`: authentication, invitations and approval screens.
- `lib/teams/index.ts`: team queries and helpers.
- `components/tracker.tsx`: forms, dashboard, workflow, details and CSV.
- `components/property-folders.tsx`: property units and linked tenants.
- `components/submission-checklist.tsx`: automatic Actions list and completion tick.
- `lib/data/domain.ts`: validation and workflow/date calculations.
- `lib/data/manual.ts`: manual tenant/unit creation and reuse.
- `lib/data/index.ts`: persistence.
- `supabase/migrations`: additive schema history; never rewrite a deployed migration.
- Migration 0005 adds submission completion; 0006 configurable stamping dates; 0007 rental/area; 0008 invitation/admin approval lockdown; 0009 rental Years 2 and 3.

## Change and verify
Build on existing tables and preserve private-team RLS. Generic agreement edits intentionally omit `submission_completed` to avoid overwriting a newer checkbox change. Keep real company data out of test fixtures. Use disposable synthetic records for mutation tests.

Run relevant tests, normally `node --test tests/workflow.test.mjs tests/teams.test.mjs tests/internal-access.test.mjs`, and `node node_modules/next/dist/bin/next build`. Do not run dev and build simultaneously against the same .next directory. Verify the changed UI and save behavior; distinguish local tests from production checks. Apply required migrations before deploying code that writes the new columns.

When deployment is in scope, commit and push the intended changes to main so GitHub triggers Vercel. Do not use `vercel deploy`. Verify the deployment is Ready and uses the production alias. Git identity: `sitinazirasharuddin-admin`, `335818130+sitinazirasharuddin-admin@users.noreply.github.com`. Use existing environment configuration; never print or commit secrets, credentials or CLI authentication stores.

GitHub contains source and migration history, not automatically live Supabase rows, auth users or storage. Repository was last known public; recheck visibility before backup, and keep P&C records out of public Git. MCP access from ChatGPT Work/Claude Cowork was requested historically but not completed; installed SDK dependencies do not prove a working connection.

This skill captures project knowledge, not the running app or a complete data backup. It does not authorize unrelated deployments, messages, account changes or data deletion. Last recorded feature release: `9075750` (open signup, private teams); verify current HEAD rather than assuming it remains latest.
