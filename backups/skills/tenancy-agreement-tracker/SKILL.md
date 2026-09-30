---
name: tenancy-agreement-tracker
description: Help operate, troubleshoot, or develop Nazira's Tenancy Agreement Tracker, including private team workspaces, property and tenant setup, agreement status progression, stamping records, and follow-up actions. Use for this existing app rather than unrelated tenancy drafting or legal stamping advice.
---

# Tenancy Agreement Tracker

## Project context

- App: https://tenancy-agreement-tracker-app.vercel.app/
- Repository: https://github.com/sitinazirasharuddin-admin/tenancy-agreement-tracker-app
- Stack: Next.js App Router, TypeScript, Supabase PostgreSQL/Auth, Vercel.
- Existing private workspace: **Leasing Team**. The user wants only one Leasing Team; do not create a duplicate as a workaround.
- Portfolio: **Menara Millenium**, **The five**, **The Stories of Taman Tunku**.
- User-selected appearance: **Candy** design, with pink/purple accents, rounded cards, property photos and mobile navigation. Preserve this choice unless asked to change it.
- Business files: `C:\Users\nazira\OneDrive - Selangor Properties Sdn Bhd\Documents\02 DATA\Tenant`.
- Companion mockups: `Team Workspace\team-workspace-mockups.html` inside that Tenant folder; online preview at `/mockups`.

Treat these as project context, not proof that the current deployment, authentication session or database is healthy. Inspect current state when troubleshooting.

## Help the user operate the app

Use simple English and short, concrete steps. The normal setup order is:

1. Open the app and sign in with the user's existing company account. Let the user enter their password; never save credentials in this skill or a project file.
2. Open the existing Leasing Team. A remembered team may open automatically.
3. Under Properties, check the existing buildings and create their units.
4. Under Tenants, add the tenant and relevant company/contact details.
5. Select New TA; choose the tenant, property and unit, enter a unique reference and person in charge, then save.
6. Move the agreement through preparation, pending signing, signed, stamping submitted, stamping completed, payment pending and completed.
7. Add outstanding actions with descriptions, due dates and priorities as needed.

The app calculates its stamping due date as signing date plus 30 calendar days. Describe this as the application's configured calculation, not legal advice or a verified statutory deadline.

Workflow buttons may open a guided editor to collect missing signing date, stamping submission date, fee or payment details. A zero fee is valid when it matches the actual record. Completion requires the applicable details, payment marked Paid or N/A, and confirmation; linked outstanding actions then close automatically.

Use the private workspace for actual business data. `/demo` contains shared public sample data and is not a place to enter company records. Invitation links are shared manually by an admin; creating a link does not mean an email was sent. Do not send invitations or messages unless the user authorizes the recipients and action.

## Develop or repair the existing app

Locate the existing checkout before cloning again. The last known checkout is:
`C:\Users\nazira\Documents\Codex\2026-09-30\clone-https-github-com-sitinazirasharuddin-admin\work\tenancy-agreement-tracker-app`.

Read the checkout's AGENTS.md and relevant docs before coding. The PRD success scenario is the acceptance criterion: create an agreement against real property/unit/tenant records, enter signing date, see the calculated deadline, create a follow-up, record stamping details and payment, complete the agreement, and see zero open actions. Preserve private-team isolation and admin/member roles.

Useful source map:

- `components/team-workspace.tsx`: authentication, team selection, settings and invitations.
- `components/tracker.tsx`: dashboard, CRUD forms, agreement workflow, actions and mobile navigation.
- `lib/data/index.ts`: database reads and writes.
- `lib/data/domain.ts`: validation, dates, urgency and workflow requirements.
- `lib/teams/index.ts`: team helpers and initial portfolio names.
- `app/globals.css` and `app/candy.css`: base layout and selected Candy theme.
- `supabase/migrations`: schema and policies. Inspect applied migrations; add a new migration for schema changes rather than rewriting deployed migrations.
- `app/mockups/page.tsx` and `export-mockups.cjs`: companion previews.

Build functional screens against the existing tables; do not replace real records with reference-design sample data or add nonfunctional controls. Reuse the supplied property photos only for the matching properties, and use a neutral placeholder for others.

When deployment is within the current request's scope, follow the repository's Git deployment process. Use the configured Git identity, commit and push to main, then verify Vercel is Ready and the production alias points to that release. Do not use `vercel deploy` to bypass Git. Pull the existing Vercel environment when necessary; never print tokens or copy environment secrets into documentation.

Verification normally includes the production build and the existing workflow/team tests. Use the disposable local database fixture for browser mutations, clearly distinguishing synthetic records from production. Confirm the changed behavior on desktop and mobile. Do not claim successful SMTP delivery, password reset, live private CRUD or deployment without checking the relevant result.

## Known limitations to recheck

As of 30 September 2026:

- Simultaneous full-record edits can overwrite another staff member's changes. Until conflict protection is implemented and tested, advise staff to avoid editing the same agreement at the same time.
- Team creation and optional initial-property insertion are separate requests; a property failure may leave a created team. Inspect and repair the existing team rather than creating a duplicate.
- Microsoft 365 SMTP configuration was saved, but actual delivery was not verified. Successful sign-in is not evidence of email delivery.
- Guided workflow forms, remembered team selection and recovery-URL cleanup were deployed in commit `9453057`; Candy styling was deployed in `77c56a0`. Verify current code before treating these as unresolved bugs.

Saving this skill does not authorize future deployments, account changes, data deletion or disclosure. Follow the user's current task scope and verify business-impacting changes before reporting completion.
