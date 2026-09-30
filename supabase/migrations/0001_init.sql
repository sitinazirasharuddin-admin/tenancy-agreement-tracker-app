create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);
alter table properties enable row level security;
drop policy if exists "properties_v1_read" on properties;
create policy "properties_v1_read" on properties for select using (true);
drop policy if exists "properties_v1_write" on properties;
create policy "properties_v1_write" on properties for all using (true) with check (true);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  property_id uuid,
  unit_number text not null,
  floor text,
  created_at timestamptz not null default now()
);
alter table units enable row level security;
drop policy if exists "units_v1_read" on units;
create policy "units_v1_read" on units for select using (true);
drop policy if exists "units_v1_write" on units;
create policy "units_v1_write" on units for all using (true) with check (true);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  company_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);
alter table tenants enable row level security;
drop policy if exists "tenants_v1_read" on tenants;
create policy "tenants_v1_read" on tenants for select using (true);
drop policy if exists "tenants_v1_write" on tenants;
create policy "tenants_v1_write" on tenants for all using (true) with check (true);

create table if not exists tenancy_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  ta_reference text not null,
  property_id uuid,
  unit_id uuid,
  tenant_id uuid,
  status text not null default 'preparation',
  signing_date date,
  commencement_date date,
  expiry_date date,
  stamping_submission_date date,
  stamping_due_date date,
  stamping_fee numeric(12,2),
  payment_status text not null default 'pending',
  person_in_charge text,
  notes text,
  created_at timestamptz not null default now()
);
alter table tenancy_agreements enable row level security;
drop policy if exists "tenancy_agreements_v1_read" on tenancy_agreements;
create policy "tenancy_agreements_v1_read" on tenancy_agreements for select using (true);
drop policy if exists "tenancy_agreements_v1_write" on tenancy_agreements;
create policy "tenancy_agreements_v1_write" on tenancy_agreements for all using (true) with check (true);

create table if not exists outstanding_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  ta_id uuid not null,
  action_type text not null,
  description text not null,
  due_date date,
  priority text not null default 'medium',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table outstanding_actions enable row level security;
drop policy if exists "outstanding_actions_v1_read" on outstanding_actions;
create policy "outstanding_actions_v1_read" on outstanding_actions for select using (true);
drop policy if exists "outstanding_actions_v1_write" on outstanding_actions;
create policy "outstanding_actions_v1_write" on outstanding_actions for all using (true) with check (true);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action_type text not null,
  target_type text not null,
  target_id uuid not null,
  before_value text,
  after_value text,
  notes text,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into properties (id, name, address) values
  ('a0000000-0000-4000-8000-000000000001', 'Menara Sentral', 'Jalan Stesen Sentral 5, KL Sentral, 50470 Kuala Lumpur'),
  ('a0000000-0000-4000-8000-000000000002', 'Plaza Damansara', 'Jalan SS 21/1, Damansara Utama, 47400 Petaling Jaya'),
  ('a0000000-0000-4000-8000-000000000003', 'The Curve Office Tower', '6 Lebuh Curve, Mutiara Damansara, 47800 Petaling Jaya')
on conflict (id) do nothing;

insert into units (id, property_id, unit_number, floor) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '12-03', '12'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '15-01', '15'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', '8-02', '8'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', '5-05', '5')
on conflict (id) do nothing;

insert into tenants (id, name, company_name, contact_email, contact_phone) values
  ('c0000000-0000-4000-8000-000000000001', 'Tan Wei Ming', 'Acme Solutions Sdn Bhd', 'weiming@acmesolutions.com.my', '+6012-345 6789'),
  ('c0000000-0000-4000-8000-000000000002', 'Siti Nurhaliza', 'Global Tech Malaysia Sdn Bhd', 'nurhaliza@globaltech.my', '+6017-123 4567'),
  ('c0000000-0000-4000-8000-000000000003', 'Raj Kumar', 'Nexus Healthcare Sdn Bhd', 'raj@nexushc.com.my', '+6019-876 5432'),
  ('c0000000-0000-4000-8000-000000000004', 'Lim Swee Ling', 'Summit Logistics Sdn Bhd', 'sweetling@summitlogistics.my', '+6013-222 3333')
on conflict (id) do nothing;

insert into tenancy_agreements (id, ta_reference, property_id, unit_id, tenant_id, status, signing_date, commencement_date, expiry_date, stamping_submission_date, stamping_due_date, stamping_fee, payment_status, person_in_charge, notes) values
  ('d0000000-0000-4000-8000-000000000001', 'TA-2024-015', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'signed', '2024-10-15', '2024-12-01', '2025-11-30', null, '2024-11-14', 1250.00, 'pending', 'Nadia Hassan', 'Signed copy received. Stamping not yet submitted.'),
  ('d0000000-0000-4000-8000-000000000002', 'TA-2024-016', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'pending_signing', null, '2025-01-15', '2026-01-14', null, null, null, 'pending', 'Nadia Hassan', 'Draft sent to tenant. Awaiting signature.'),
  ('d0000000-0000-4000-8000-000000000003', 'TA-2024-014', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'stamping_submitted', '2024-11-01', '2024-12-15', '2025-12-14', '2024-11-20', '2024-12-01', 980.00, 'pending', 'Arif Mansor', 'Submitted to LHDN on 20 Nov. Awaiting stamped copy.'),
  ('d0000000-0000-4000-8000-000000000004', 'TA-2024-013', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'completed', '2024-09-01', '2024-10-01', '2025-09-30', '2024-09-15', '2024-10-01', 1100.00, 'paid', 'Arif Mansor', 'Fully completed and filed.'),
  ('d0000000-0000-4000-8000-000000000005', 'TA-2024-017', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'preparation', null, '2025-02-01', '2026-01-31', null, null, null, 'pending', 'Nadia Hassan', 'Lease terms under review.')
on conflict (id) do nothing;

insert into outstanding_actions (id, ta_id, action_type, description, due_date, priority, completed) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'stamping', 'Submit TA-2024-015 for stamping at LHDN', '2024-11-14', 'high', false),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'signing', 'Follow up with Global Tech for signed TA-2024-016', '2024-12-10', 'medium', false),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'payment', 'Pay stamping fee RM980 for TA-2024-014', '2024-12-01', 'medium', false),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'filing', 'Collect original signed copy from tenant for TA-2024-015', '2024-11-20', 'medium', false),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000005', 'drafting', 'Prepare first draft of TA-2024-017', '2024-12-20', 'low', false)
on conflict (id) do nothing;

insert into audit_logs (id, action_type, target_type, target_id, before_value, after_value, notes) values
  ('f0000000-0000-4000-8000-000000000001', 'update_status', 'tenancy_agreement', 'd0000000-0000-4000-8000-000000000001', '{"status": "pending_signing"}', '{"status": "signed"}', 'TA-2024-015 marked as signed after receiving signed copy'),
  ('f0000000-0000-4000-8000-000000000002', 'update_status', 'tenancy_agreement', 'd0000000-0000-4000-8000-000000000003', '{"status": "signed"}', '{"status": "stamping_submitted"}', 'TA-2024-014 submitted to LHDN for stamping')
on conflict (id) do nothing;