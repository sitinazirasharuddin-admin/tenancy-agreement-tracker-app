# Tenancy Agreement Tracker

A shared, login-free leasing demo built with Next.js and Supabase. Use sample data only until owner-scoped authentication is implemented. The homepage is the working application.

## Run against the provisioned Supabase project

1. Use Node 22.18+ and run `npm ci`.
2. Authenticate Vercel CLI, run `vercel link`, select the existing project, and run `vercel env pull .env.local`.
3. Verify the migration history and tables in that project's Supabase database. Apply `0001_init.sql` only if it is not already applied. Preserve existing data.
4. Apply `supabase/migrations/0002_workflow_integrity.sql` as a new migration. This is required for atomic agreement completion, linked action deletion, integrity checks, and auditing. If existing data violates a new constraint, resolve the conflict before applying; do not reset the database.
5. Run `npm run dev`.

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for the tracker. Never expose a service-role key in frontend variables. No payment gateway is part of this app.

## Core job

Create a property, unit and tenant, or select existing sample records. Create an agreement, send it for signing, record the signing date, and mark it signed. The stamping deadline is calculated as 30 calendar days after signing. Add a follow-up such as "Submit to LHDN". Record the submission date and fee, mark payment paid or N/A, and complete the agreement. Completion explicitly confirms closing all linked actions, then updates the agreement and actions in one database transaction.

Dashboard filters support status, property, staff and reference/tenant search. Actions are ranked by deterministic urgency. CSV exports respect active filters. Referenced properties, units and tenants cannot be deleted until dependent records are removed.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm test`: real PostgreSQL (PGlite) migration tests, calendar boundaries, workflow integrity, completion and audit checks.
- Browser regression tests use a test-only local PostgreSQL adapter, not the hosted Supabase service. Run `npm run test:db`, then start Next with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-postgres-test-only` in the process environment. Run `npm run test:browser` and `node tests/management-smoke.mjs`. Microsoft Edge is used headlessly.
- The local test adapter is under `tests/`; production code has no fallback database or fabricated-success mode.

Live verification must separately repeat `docs/TEST_PLAN.md` after migrations are applied and the Vercel deployment is ready. Local tests do not establish hosted Supabase or deployment readiness.

## Deployment

Commit as `sitinazirasharuddin-admin <335818130+sitinazirasharuddin-admin@users.noreply.github.com>` and push to `main`; Vercel builds from GitHub. Do not use `vercel deploy`.

## Scope

Sprints 1–3 implement the complete agreement workflow. The team-workspace release adds authenticated admin/member teams and database isolation at `/`; the public sample tracker remains at `/demo`. See `docs/TEAM_WORKSPACES.md` for migration, setup, verification and email-delivery requirements.

## Hosted database verification (2026-09-30)

The existing five seed agreements were verified before applying `0002_workflow_integrity.sql` to the provisioned project. The hosted anonymous-client regression (`node --env-file=.env.local tests/live-db.mjs`) passed for creation, signing deadline calculation, rejecting premature completion, atomic action closure, audit entries, and cascading removal of its generated QA records. Existing seed records were preserved.
