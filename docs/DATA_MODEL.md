# Data Model

## tenancy_agreements
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | nullable (owner-scoped at lock-down) |
| ta_reference | text | e.g. TA-2024-015 |
| property_id | uuid | → properties.id |
| unit_id | uuid | → units.id |
| tenant_id | uuid | → tenants.id |
| status | text | preparation, pending_signing, signed, stamping_submitted, stamping_completed, payment_pending, completed |
| signing_date | date | both parties signed |
| commencement_date | date | lease start |
| expiry_date | date | lease end |
| stamping_submission_date | date | submitted to LHDN |
| stamping_due_date | date | auto = signing_date + 30 days |
| stamping_fee | numeric(12,2) | RM amount |
| payment_status | text | pending, partial, paid, na |
| person_in_charge | text | leasing staff name |
| notes | text | free text |
| created_at | timestamptz | |

## properties
id uuid PK, user_id uuid, name text, address text, created_at.

## units
id uuid PK, user_id uuid, property_id uuid (→ properties), unit_number text, floor text, created_at.

## tenants
id uuid PK, user_id uuid, name text, company_name text, contact_email text, contact_phone text, created_at.

## outstanding_actions
id uuid PK, user_id uuid, ta_id uuid (→ tenancy_agreements), action_type text (signing/stamping/payment/filing/drafting), description text, due_date date, priority text (low/medium/high), completed boolean, completed_at timestamptz, created_at.

## audit_logs
id uuid PK, user_id uuid, action_type text, target_type text, target_id uuid, before_value text (JSON), after_value text (JSON), notes text, created_at.

## RLS
All tables: RLS enabled. v1 policies = permissive (select/write for all). Lock-down sprint replaces with `auth.uid() = user_id` owner scoping.

## AI Fields (later)
Future AI-suggested actions will add `ai_value text`, `source text`, `confidence numeric`, `review_status text default 'unreviewed'` on outstanding_actions or a dedicated suggestions table.
## Tenant submission checklist

Migration `0005_submission_checklist.sql` adds `tenancy_agreements.submission_completed boolean not null default false`. Actions reads the same scoped agreements as the dashboard, with no extra action creation. The checkbox is independent of workflow status, may be unticked, and uses existing team RLS and audit logging. Existing records start pending; generic agreement edits omit this field so stale forms cannot overwrite a newer tick.
