begin;
-- Only server-created accounts carrying verified administrator metadata may register.
create or replace function public.provision_admin_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; team uuid; member_role text; account_row auth.users%rowtype;
begin
 select * into account_row from auth.users where id=new.id;
 if not found then return new; end if;
 owner_id := (account_row.raw_app_meta_data->>'provisioned_by')::uuid;
 team := (account_row.raw_app_meta_data->>'provisioned_team')::uuid;
 member_role := account_row.raw_app_meta_data->>'provisioned_role';
 if owner_id is null or team is null or member_role is null or member_role not in ('admin','member') or
 not exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id join auth.users u on u.id=m.user_id
 where m.team_id=team and m.user_id=owner_id and m.role='admin' and t.archived_at is null and coalesce(u.raw_app_meta_data->>'must_change_password','false') <> 'true') then
 raise exception 'Account creation is managed by your workspace administrator';
 end if;
 if coalesce(account_row.raw_app_meta_data->>'must_change_password','false') <> 'true' then raise exception 'A temporary password is required'; end if;
 insert into public.team_members(team_id,user_id,email,role) values(team,new.id,lower(account_row.email),member_role);
 return new;
end $$;
drop trigger provision_admin_account on auth.users;
create constraint trigger provision_admin_account after insert on auth.users deferrable initially deferred for each row execute function public.provision_admin_account();

commit;

