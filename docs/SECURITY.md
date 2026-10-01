# Internal access security

The production app is invitation-only following migration 0008. The old demo-first design is superseded.

- A database trigger on `auth.users` checks an unused, unexpired invitation matching the registration email. Direct signup API calls must pass the same check. Client metadata is only an invitation token to validate, never a trusted role or membership claim.
- Registration queues a request; it never inserts a team membership. Email confirmation is required before approval.
- Only an existing administrator of the invited, active team can approve or reject via `review_registration`. Approved applicants become members, not administrators. Decisions are audited.
- Existing approved team members retain access. Open workspace creation is disabled. Existing accounts without membership may sign in only to request access; they cannot read business data.
- All business tables and audit logs require active team membership through RLS. Anonymous privileges and NULL-team demo access are removed. Sample records are preserved but inaccessible to normal clients.
- `/demo`, `/mockups` and `/previews/*` lead to sign-in. Closing the demo is enforced in the database as well as the UI.
- Invitations are email-bound, expire in seven days, and can be revoked. If a pending invitation expires, create a new one and ask the existing applicant to sign in and request approval with the new code.
- Membership removal immediately prevents subsequent database access, including with an existing session. It cannot retract data already viewed or exported.

## Administrator workflow
1. Open Team settings and create an invitation for the colleague's email.
2. Copy and share the invitation link through an approved company channel. Creating a link does not email it automatically.
3. The colleague registers with that email, confirms the emailed verification link and waits for approval.
4. Open Team settings → Invitations & registration approvals. Refresh registrations & members, then approve or reject the named applicant.
5. The applicant signs in and clicks Check approval status, then opens the workspace.

## Validation
`tests/internal-access.test.mjs` exercises denied anonymous access, preserved admin access, absent/wrong/expired invites, pending users, email confirmation, self-approval denial, cross-team admin denial, blocked direct membership insertion, approval, rejection and membership removal. It invokes the auth trigger with a simulated auth-service database role. Earlier migration tests remain historical regression coverage, not the final policy.

No service-role secret is shipped to the browser. This change does not enable MFA, change GitHub visibility, establish database backups, or certify compliance with company IT policy.
