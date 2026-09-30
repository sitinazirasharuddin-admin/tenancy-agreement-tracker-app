# Manual New TA entry

New Agreement now accepts Tenant and Unit as required text fields; Property remains a dropdown. Existing agreement editing continues to use linked-record selectors.

On save, the app reloads records scoped to the current workspace, reuses a unique tenant display-name match and a matching unit number within the selected property (case-insensitive, trimmed), or creates missing records. All agreement validation runs before creating related records. Ambiguous duplicate matches require resolution rather than choosing an arbitrary record.

No migration is required. Creation uses the existing RLS-protected tables. Related-record inserts and agreement save are separate requests: after a partial network failure, a created tenant/unit may remain available; retry reloads and reuses it. Simultaneous creation is not guaranteed duplicate-free.

Validation: six tests and production build passed. In the local PostgreSQL browser fixture, two New TAs entered manually saved successfully and referenced exactly one newly created tenant and unit, including case-insensitive reuse. No production data was added during testing.
