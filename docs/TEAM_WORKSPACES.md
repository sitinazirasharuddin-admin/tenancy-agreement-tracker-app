# Team workspaces — release and handover

## What changed

The homepage now opens authenticated private team workspaces. A user can create multiple teams, switch between them, invite members by verified email, and manage admin/member roles. Each team's properties, units, tenants, agreements, actions and audit records are isolated by PostgreSQL row-level security.

Admins can invite/revoke invitations, change roles, remove members and delete business records. Members can create and update the team's records, complete follow-ups and export its agreements. The last admin cannot be removed or demoted. Invitation links expire after seven days and only the intended email can accept them.

The complete signing, stamping, payment and completion workflow is unchanged. Stamping due dates are signing date + 30 calendar days, and agreement completion closes outstanding actions atomically.

## Pages

- `/`: sign in, create/join a team and work in the private tracker.
- `/demo`: public sample-only tracker. Never enter real tenant details here.
- `/mockups`: new desktop/mobile design preview using fictional tenant data.
- `/previews/team-workspace-mockups.html`: downloadable self-contained design preview.

New team onboarding optionally adds Menara Millenium, The five and The Stories of Taman Tunku as properties. These names match the available folders under `02 DATA\Tenant`; no tenant files were available locally to import.

## Database and authentication

`0003_team_workspaces.sql` was applied to the provisioned Supabase project on 30 September 2026. Existing public demo records were preserved. Apply it after migrations 0001 and 0002 on any new environment. Do not reapply it to the provisioned database.

The Supabase Site URL and two exact callback URLs now point to the production Vercel domain. Email confirmation remains required; configure a custom SMTP sender before onboarding ordinary team users. At the last inspected state, custom SMTP was disabled. Signup confirmation and password reset delivery have not yet been verified with a real mailbox.

Invitation links are created in Team settings and copied/shared by the admin; the app does not send invitation email itself. New users still need account confirmation. An invitation is retained in the browser session while signup is completed.

## Verification performed

- Production Next.js build and TypeScript checks.
- PostgreSQL tests: private-team RLS; cross-team reads/writes and references denied; member role escalation/deletion denied; invitation email matching and one-time acceptance; last-admin protection; removal revokes access; private audit isolation; complete agreement workflow.
- Hosted Supabase regression after migration: anonymous demo CRUD, signing deadline, completion validation, atomic action closure and audit entries passed. Generated QA agreement/action removed; existing samples preserved.
- Browser against disposable loopback PostgreSQL and synthetic identities: sign in, create private workspace with portfolio properties, add tenant/unit/agreement, deadline calculation, stamping/payment completion, invitation creation and acceptance, member workspace access and restricted settings. Reload preserved the completed agreement.
- Phone width 390px: member settings, agreement cards/detail and form inspected. No document-level horizontal overflow; form has large controls and sticky save/cancel actions.

The local auth fixture is test-only. It does not prove production email delivery or create real Supabase accounts.

## Local test fixtures

`node tests/team-db.mjs` starts disposable PostgreSQL at 127.0.0.1:54322. Start Next with that Supabase URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-only` in the process environment. Synthetic alice@example.com and bob@example.com accept any test password. `node tests/seed-team-ui.mjs` creates a sample private agreement for completion checks. Never point these scripts at production.

`npm test` runs the workflow and team-isolation suites. The original demo browser scripts now use `/demo` and the shared adapter on port 54321.
