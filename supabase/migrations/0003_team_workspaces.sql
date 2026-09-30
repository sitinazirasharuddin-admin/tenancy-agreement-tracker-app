-- Private team workspaces. Existing NULL-team records remain a sample-only demo.
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 80),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 email text not null,
 role text not null check(role in ('admin','member')),
 created_at timestamptz not null default now(),
 primary key(team_id,user_id)
);
create table public.team_invites (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 email text not null check(position('@' in email)>1),
 token uuid not null unique default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
create or replace function public.is_team_member(team uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from team_members where team_id=team and user_id=auth.uid());
$$;
create or replace function public.is_team_admin(team uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from team_members where team_id=team and user_id=auth.uid() and role='admin');
$$;
create policy teams_read on public.teams for select to authenticated using(public.is_team_member(id));
create policy members_read on public.team_members for select to authenticated using(public.is_team_member(team_id));
create policy invites_read on public.team_invites for select to authenticated using(public.is_team_admin(team_id));
revoke all on public.teams,public.team_members,public.team_invites from anon,authenticated;
grant select on public.teams,public.team_members,public.team_invites to authenticated;
create or replace function public.create_team(team_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into teams(name,created_by) values(trim(team_name),auth.uid()) returning id into new_id;
 insert into team_members(team_id,user_id,email,role) values(new_id,auth.uid(),lower(auth.jwt()->>'email'),'admin');
 return new_id;
end $$;
create or replace function public.invite_team_member(team uuid,invite_email text) returns uuid language plpgsql security definer set search_path=public as $$
declare code uuid;
begin
 if not is_team_admin(team) then raise exception 'Only team admins can invite members'; end if;
 if exists(select 1 from team_members where team_id=team and lower(email)=lower(trim(invite_email))) then raise exception 'This person is already a member'; end if;
 update team_invites set revoked_at=now() where team_id=team and email=lower(trim(invite_email)) and accepted_at is null and revoked_at is null;
 insert into team_invites(team_id,email,created_by) values(team,lower(trim(invite_email)),auth.uid()) returning token into code;
 return code;
end $$;
create or replace function public.accept_team_invite(invite_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare invitation team_invites;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into invitation from team_invites where token=invite_token for update;
 if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<now() then raise exception 'Invitation is invalid or expired'; end if;
 if lower(coalesce(auth.jwt()->>'email',''))<>invitation.email then raise exception 'Sign in using the email address this invitation was created for'; end if;
 insert into team_members(team_id,user_id,email,role) values(invitation.team_id,auth.uid(),invitation.email,'member') on conflict(team_id,user_id) do nothing;
 update team_invites set accepted_at=now() where id=invitation.id;
 return invitation.team_id;
end $$;
create or replace function public.revoke_team_invite(invite_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from team_invites where id=invite_id and is_team_admin(team_id)) then raise exception 'Only team admins can revoke invitations'; end if;
 update team_invites set revoked_at=now() where id=invite_id;
end $$;
create or replace function public.manage_team_member(team uuid,member_id uuid,new_role text) returns void language plpgsql security definer set search_path=public as $$
declare existing_role text;
begin
 perform 1 from teams where id=team for update;
 if not is_team_admin(team) then raise exception 'Only team admins can manage members'; end if;
 if new_role is not null and new_role not in ('admin','member') then raise exception 'Invalid role'; end if;
 select role into existing_role from team_members where team_id=team and user_id=member_id;
 if existing_role is null then raise exception 'Member not found'; end if;
 if existing_role='admin' and new_role is distinct from 'admin' and (select count(*) from team_members where team_id=team and role='admin')<=1 then raise exception 'A team must retain at least one admin'; end if;
 if new_role is null then delete from team_members where team_id=team and user_id=member_id;
 else update team_members set role=new_role where team_id=team and user_id=member_id; end if;
end $$;
revoke all on function public.create_team(text), public.invite_team_member(uuid,text), public.accept_team_invite(uuid),public.revoke_team_invite(uuid),public.manage_team_member(uuid,uuid,text) from public,anon;
grant execute on function public.create_team(text), public.invite_team_member(uuid,text), public.accept_team_invite(uuid),public.revoke_team_invite(uuid),public.manage_team_member(uuid,uuid,text) to authenticated;
-- Apply isolation to every business object, including the audit trail.
do $$ declare t text; begin
 foreach t in array array['properties','units','tenants','tenancy_agreements','outstanding_actions','audit_logs'] loop
  execute format('alter table public.%I add column team_id uuid references public.teams(id)',t);
  execute format('create index %I on public.%I(team_id)',t||'_team_idx',t);
  execute format('drop policy if exists %I on public.%I',t||'_v1_read',t);
  execute format('drop policy if exists %I on public.%I',t||'_v1_write',t);
  execute format('create policy team_read on public.%I for select using(team_id is null or public.is_team_member(team_id))',t);
  if t<>'audit_logs' then
   execute format('create policy team_insert on public.%I for insert with check((team_id is null and user_id is null) or public.is_team_member(team_id))',t);
   execute format('create policy team_update on public.%I for update using(team_id is null or public.is_team_member(team_id)) with check((team_id is null and user_id is null) or public.is_team_member(team_id))',t);
   execute format('create policy team_delete on public.%I for delete using(team_id is null or public.is_team_admin(team_id))',t);
  end if;
 end loop;
end $$;
drop index public.ta_reference_unique;
create unique index ta_demo_reference_unique on public.tenancy_agreements(lower(trim(ta_reference))) where team_id is null;
create unique index ta_team_reference_unique on public.tenancy_agreements(team_id,lower(trim(ta_reference))) where team_id is not null;
create or replace function public.check_workspace_record() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and new.team_id is distinct from old.team_id then raise exception 'Records cannot be moved between workspaces'; end if;
 if TG_OP='INSERT' then new.user_id:=case when new.team_id is null then null else auth.uid() end;
 else new.user_id:=old.user_id; end if;
 if TG_TABLE_NAME in ('units','tenancy_agreements') then
  if new.property_id is not null and not exists(select 1 from properties where id=new.property_id and team_id is not distinct from new.team_id) then raise exception 'Property must belong to this workspace'; end if;
 end if;
 if TG_TABLE_NAME='tenancy_agreements' then
  if new.unit_id is not null and not exists(select 1 from units where id=new.unit_id and team_id is not distinct from new.team_id) then raise exception 'Unit must belong to this workspace'; end if;
  if new.tenant_id is not null and not exists(select 1 from tenants where id=new.tenant_id and team_id is not distinct from new.team_id) then raise exception 'Tenant must belong to this workspace'; end if;
 end if;
 if TG_TABLE_NAME='outstanding_actions' then
  if not exists(select 1 from tenancy_agreements where id=new.ta_id and team_id is not distinct from new.team_id) then raise exception 'Agreement must belong to this workspace'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['properties','units','tenants','tenancy_agreements','outstanding_actions'] loop
 execute format('create trigger check_workspace before insert or update on public.%I for each row execute function public.check_workspace_record()',t);
 end loop;
end $$;
create or replace function public.record_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_logs(user_id,team_id,action_type,target_type,target_id,before_value,after_value)
 values(auth.uid(),coalesce(new.team_id,old.team_id),lower(TG_OP),TG_TABLE_NAME,coalesce(new.id,old.id),case when TG_OP<>'INSERT' then row_to_json(old)::text end,case when TG_OP<>'DELETE' then row_to_json(new)::text end);
 return coalesce(new,old);
end $$;
