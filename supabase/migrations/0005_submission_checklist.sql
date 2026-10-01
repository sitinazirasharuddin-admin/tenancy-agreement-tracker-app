-- Submission receipt is independent of signing, stamping and payment workflow.
-- Existing records remain pending until a team member explicitly ticks them.
alter table public.tenancy_agreements
  add column if not exists submission_completed boolean not null default false;
comment on column public.tenancy_agreements.submission_completed is
  'Tenant submission checklist tick, independent of agreement workflow status.';
notify pgrst, 'reload schema';
