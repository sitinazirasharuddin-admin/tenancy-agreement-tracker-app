begin;
do $$ begin
 if not exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id where m.role='admin' and t.archived_at is null) then
  raise exception 'An existing active workspace administrator is required before enabling internal access';
 end if;
end $$;
-- Existing team members retain their access. New members require admin approval.
alter table public.team_invites
 add column requested_by uuid references auth.users(id) on delete set null,
 add column requested_at timestamptz,
 add column reviewed_by uuid references auth.users(id) on delete set null;

create or replace function public.is_team_member(team uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id
 where m.team_id=team and m.user_id=auth.uid() and t.archived_at is null);
$$;
create or replace function public.is_team_admin(team uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id
 where m.team_id=team and m.user_id=auth.uid() and m.role='admin' and t.archived_at is null);
$$;
-- Close both the demo UI and the direct database API. Preserve sample rows privately.
do $$ declare t text; begin
 foreach t in array array['properties','units','tenants','tenancy_agreements','outstanding_actions','audit_logs'] loop
  execute format('alter policy team_read on public.%I to authenticated using (public.is_team_member(team_id))',t);
  if t <> 'audit_logs' then
   execute format('alter policy team_insert on public.%I to authenticated with check (public.is_team_member(team_id))',t);
   execute format('alter policy team_update on public.%I to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id))',t);
   execute format('alter policy team_delete on public.%I to authenticated using (public.is_team_admin(team_id))',t);
  end if;
  execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
create or replace function public.create_team(team_name text) returns uuid
language plpgsql security definer set search_path='' as $$
begin raise exception 'Workspace creation is disabled. Ask your administrator for an invitation.'; end $$;

alter policy invites_read on public.team_invites using
 (public.is_team_admin(team_id) or requested_by=auth.uid());

-- Checked on the actual auth.users INSERT, so direct signup API calls cannot bypass it.
create or replace function public.require_registration_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
declare invitation public.team_invites;
begin
 select i.* into invitation from public.team_invites i join public.teams t on t.id=i.team_id
 where i.token::text=coalesce(new.raw_user_meta_data->>'invitation_token','')
 and lower(i.email)=lower(new.email) and i.accepted_at is null and i.revoked_at is null
 and i.expires_at>now() and i.requested_by is null and t.archived_at is null
 for update of i;
 if not found then raise exception 'A valid administrator invitation for this email is required.'; end if;
 update public.team_invites set requested_by=new.id, requested_at=now() where id=invitation.id;
 return new;
end $$;
revoke all on function public.require_registration_invitation() from public,anon,authenticated;
create trigger require_registration_invitation after insert on auth.users
 for each row execute function public.require_registration_invitation();

-- Existing accounts also request approval; accepting a link never grants membership.
create or replace function public.accept_team_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.team_invites; account_email text; confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select email,email_confirmed_at into account_email,confirmed from auth.users where id=auth.uid();
 if confirmed is null then raise exception 'Confirm your email address before requesting access.'; end if;
 select i.* into invitation from public.team_invites i join public.teams t on t.id=i.team_id
 where i.token=invite_token and t.archived_at is null for update of i;
 if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then
  raise exception 'Invitation is invalid or expired'; end if;
 if lower(coalesce(account_email,''))<>lower(invitation.email) then raise exception 'Sign in using the email address this invitation was created for'; end if;
 if invitation.requested_by is not null and invitation.requested_by<>auth.uid() then raise exception 'Invitation already used'; end if;
 update public.team_invites set requested_by=auth.uid(),requested_at=coalesce(requested_at,now()) where id=invitation.id;
 return invitation.team_id;
end $$;

create or replace function public.review_registration(invite_id uuid, approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare invitation public.team_invites; account_email text; confirmed timestamptz;
begin
 select * into invitation from public.team_invites where id=invite_id for update;
 if not found or not public.is_team_admin(invitation.team_id) then raise exception 'Only team admins can review registrations'; end if;
 if invitation.requested_by is null or invitation.accepted_at is not null or invitation.revoked_at is not null then raise exception 'No pending registration for this invitation'; end if;
 if approve then
  if invitation.expires_at<=now() then raise exception 'Invitation expired. Create a new invitation.'; end if;
  select email,email_confirmed_at into account_email,confirmed from auth.users where id=invitation.requested_by;
  if confirmed is null or lower(coalesce(account_email,''))<>lower(invitation.email) then raise exception 'The applicant must confirm the invited email address first'; end if;
  insert into public.team_members(team_id,user_id,email,role)
   values(invitation.team_id,invitation.requested_by,invitation.email,'member') on conflict(team_id,user_id) do nothing;
  update public.team_invites set accepted_at=now(),reviewed_by=auth.uid() where id=invite_id;
 else
  update public.team_invites set revoked_at=now(),reviewed_by=auth.uid() where id=invite_id;
 end if;
 insert into public.audit_logs(user_id,team_id,action_type,target_type,target_id,notes)
 values(auth.uid(),invitation.team_id,case when approve then 'registration_approved' else 'registration_rejected' end,'team_invites',invite_id,invitation.email);
end $$;
revoke all on function public.review_registration(uuid,boolean) from public,anon;
grant execute on function public.review_registration(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
