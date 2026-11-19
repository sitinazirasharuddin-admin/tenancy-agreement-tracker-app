begin;
-- Only server-created accounts carrying verified administrator metadata may register.
create or replace function public.provision_admin_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; team uuid; member_role text;
begin
 owner_id := (new.raw_app_meta_data->>'provisioned_by')::uuid;
 team := (new.raw_app_meta_data->>'provisioned_team')::uuid;
 member_role := new.raw_app_meta_data->>'provisioned_role';
 if owner_id is null or team is null or member_role is null or member_role not in ('admin','member') or
 not exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id join auth.users u on u.id=m.user_id
 where m.team_id=team and m.user_id=owner_id and m.role='admin' and t.archived_at is null and coalesce(u.raw_app_meta_data->>'must_change_password','false') <> 'true') then
 raise exception 'Account creation is managed by your workspace administrator';
 end if;
 if coalesce(new.raw_app_meta_data->>'must_change_password','false') <> 'true' then raise exception 'A temporary password is required'; end if;
 insert into public.team_members(team_id,user_id,email,role) values(team,new.id,lower(new.email),member_role);
 return new;
end $$;
create trigger provision_admin_account after insert on auth.users for each row execute function public.provision_admin_account();
-- Auth owns password hashing. Only an actual password change clears the first-login gate.
create or replace function public.complete_first_password_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.raw_app_meta_data->>'must_change_password'='true' and new.encrypted_password is distinct from old.encrypted_password
 and new.raw_app_meta_data->>'password_reset_nonce' is not distinct from old.raw_app_meta_data->>'password_reset_nonce' then
 new.raw_app_meta_data := jsonb_set(new.raw_app_meta_data,'{must_change_password}','false'::jsonb);
 end if;
 return new;
end $$;
create trigger complete_first_password_change before update on auth.users for each row execute function public.complete_first_password_change();
create or replace function public.is_team_member(team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id join auth.users u on u.id=m.user_id
 where m.team_id=team and m.user_id=auth.uid() and t.archived_at is null and coalesce(u.raw_app_meta_data->>'must_change_password','false') <> 'true');
$$;
create or replace function public.is_team_admin(team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id join auth.users u on u.id=m.user_id
 where m.team_id=team and m.user_id=auth.uid() and m.role='admin' and t.archived_at is null and coalesce(u.raw_app_meta_data->>'must_change_password','false') <> 'true');
$$;
revoke all on function public.provision_admin_account(),public.complete_first_password_change() from public,anon,authenticated;
-- Retire self-service workspace creation and email invitations.
revoke execute on function public.create_team(text),public.accept_team_invite(uuid),public.invite_team_member(uuid,text) from authenticated;
notify pgrst, 'reload schema';
commit;
