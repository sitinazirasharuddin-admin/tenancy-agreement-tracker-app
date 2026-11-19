# Admin-managed accounts

19 November 2026: public registration is retired. Team administrators create accounts in Team settings with name, email, role and a temporary password. No confirmation email is sent for these accounts. Administrators share credentials privately; the app does not send them or retain readable passwords.

Deploy migration 0012_admin_accounts.sql before the UI. It rejects auth-user inserts without server-owned metadata naming an existing active team admin and inserts team membership atomically. Never expose SUPABASE_SERVICE_ROLE_KEY; configure it only in Vercel server environment. The API authenticates the caller, checks current team-admin rights and request origin, then calls Supabase Admin Auth. Existing emails are not overwritten.

New accounts and admin password resets have a server-owned must_change_password flag. Database membership helpers deny business data access until Auth changes the password hash. User-editable metadata cannot clear the flag. Resets change a nonce so they retain the gate. Reset is limited to accounts provisioned for the same team and excludes the acting administrator. Removing a member withdraws team access without deleting their account.

Verification: node --test tests/admin-accounts.test.mjs tests/auth-errors.test.mjs and production build. Live creation and first password change still need verification after the server credential and migration are installed. SMTP-dependent self-service forgot-password remains unavailable while Microsoft 365 sending is broken; members should ask their administrator for a temporary-password reset.
