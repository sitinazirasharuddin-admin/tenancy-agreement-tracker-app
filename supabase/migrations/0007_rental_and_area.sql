begin;
alter table public.tenancy_agreements
  add column monthly_rental numeric(12,2) check (monthly_rental >= 0),
  add column total_square_feet numeric(12,2) check (total_square_feet >= 0);
notify pgrst, 'reload schema';
commit;
