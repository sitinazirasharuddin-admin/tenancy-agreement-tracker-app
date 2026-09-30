-- Preserve 0001. Apply this additive migration after checking existing migration history.
-- Database-owned dates, atomic completion, referential integrity, and append-only audit.
alter table units add constraint units_property_fk foreign key (property_id) references properties(id);
alter table tenancy_agreements add constraint ta_property_fk foreign key (property_id) references properties(id);
alter table tenancy_agreements add constraint ta_unit_fk foreign key (unit_id) references units(id);
alter table tenancy_agreements add constraint ta_tenant_fk foreign key (tenant_id) references tenants(id);
alter table outstanding_actions add constraint action_ta_fk foreign key (ta_id) references tenancy_agreements(id) on delete cascade;
alter table tenancy_agreements add constraint valid_status check (status in ('preparation','pending_signing','signed','stamping_submitted','stamping_completed','payment_pending','completed'));
alter table tenancy_agreements add constraint valid_payment check (payment_status in ('pending','partial','paid','na'));
alter table tenancy_agreements add constraint valid_lease_dates check (expiry_date >= commencement_date);
alter table tenancy_agreements add constraint valid_fee check (stamping_fee >= 0);
alter table outstanding_actions add constraint valid_priority check (priority in ('low','medium','high'));
alter table outstanding_actions add constraint valid_action_type check (action_type in ('signing','stamping','payment','filing','drafting'));
create unique index ta_reference_unique on tenancy_agreements(lower(trim(ta_reference)));
create index action_ta_index on outstanding_actions(ta_id);
create index ta_property_index on tenancy_agreements(property_id);
create or replace function public.prepare_agreement() returns trigger language plpgsql set search_path = public as $$
begin
  new.ta_reference := trim(new.ta_reference);
  if new.ta_reference = '' then raise exception 'Agreement reference is required'; end if;
  if new.unit_id is not null and not exists (select 1 from units where id = new.unit_id and property_id = new.property_id) then raise exception 'Unit must belong to the selected property'; end if;
  new.stamping_due_date := new.signing_date + 30;
  if new.status = 'completed' and (new.signing_date is null or new.stamping_submission_date is null or new.stamping_fee is null or new.payment_status not in ('paid','na')) then raise exception 'Complete signing, stamping, fee and payment details first'; end if;
  return new;
end $$;
create trigger prepare_agreement before insert or update on tenancy_agreements for each row execute function prepare_agreement();
create or replace function public.close_agreement_actions() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' then
    update outstanding_actions set completed = true, completed_at = now() where ta_id = new.id and not completed;
  end if;
  return new;
end $$;
create trigger close_agreement_actions after insert or update on tenancy_agreements for each row execute function close_agreement_actions();
create or replace function public.prepare_action() returns trigger language plpgsql set search_path = public as $$
begin
  if trim(new.description) = '' then raise exception 'Action description is required'; end if;
  if not new.completed and exists(select 1 from tenancy_agreements where id = new.ta_id and status = 'completed') then raise exception 'Reopen the agreement before adding an outstanding action'; end if;
  new.completed_at := case when new.completed then coalesce(new.completed_at, now()) else null end;
  return new;
end $$;
create trigger prepare_action before insert or update on outstanding_actions for each row execute function prepare_action();
create or replace function public.record_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs(user_id,action_type,target_type,target_id,before_value,after_value)
  values(auth.uid(),lower(TG_OP),TG_TABLE_NAME,coalesce(new.id,old.id),case when TG_OP <> 'INSERT' then row_to_json(old)::text end,case when TG_OP <> 'DELETE' then row_to_json(new)::text end);
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['properties','units','tenants','tenancy_agreements','outstanding_actions'] loop
    execute format('create trigger audit_change after insert or update or delete on %I for each row execute function record_change()', t);
  end loop;
end $$;
drop policy if exists audit_logs_v1_write on audit_logs;
revoke insert, update, delete on audit_logs from anon, authenticated;
-- Keep a referenced unit in its original property, so linked agreements remain valid.
create or replace function public.protect_unit_property() returns trigger language plpgsql set search_path = public as $$
begin
  if new.property_id is distinct from old.property_id and exists(select 1 from tenancy_agreements where unit_id = old.id) then
    raise exception 'This unit is linked to an agreement; its property cannot be changed';
  end if;
  return new;
end $$;
create trigger protect_unit_property before update on units for each row execute function protect_unit_property();
