begin;
alter table public.tenancy_agreements add column stamping_due_days integer not null default 14
  check (stamping_due_days between 0 and 3650);
create or replace function public.prepare_agreement() returns trigger language plpgsql set search_path = public as $$
begin
  new.ta_reference := trim(new.ta_reference);
  if new.ta_reference = '' then raise exception 'Agreement reference is required'; end if;
  if new.unit_id is not null and not exists (select 1 from units where id = new.unit_id and property_id = new.property_id) then raise exception 'Unit must belong to the selected property'; end if;
  new.stamping_due_date := new.stamping_submission_date + new.stamping_due_days;
  if new.status = 'completed' and (new.signing_date is null or new.stamping_submission_date is null or new.stamping_fee is null or new.payment_status not in ('paid','na')) then raise exception 'Complete signing, stamping, fee and payment details first'; end if;
  return new;
end $$;
update public.tenancy_agreements
set stamping_due_date = stamping_submission_date + stamping_due_days;
notify pgrst, 'reload schema';
commit;
