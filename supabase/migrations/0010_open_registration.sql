begin;
-- Public account registration; existing team records remain protected by RLS.
drop trigger if exists require_registration_invitation on auth.users;
create or replace function public.create_team(team_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid; account_email text;
begin
 select email into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if account_email is null then raise exception 'Sign in with a confirmed email first'; end if;
 if length(trim(team_name))=0 or length(trim(team_name))>120 or team_name is null then raise exception 'Enter a workspace name (1-120 characters)'; end if;
 insert into public.teams(name,created_by) values(trim(team_name),auth.uid()) returning id into new_id;
 insert into public.team_members(team_id,user_id,email,role) values(new_id,auth.uid(),lower(account_email),'admin');
 return new_id;
end $$;
create or replace function public.accept_team_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.team_invites; account_email text;
begin
 select email into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if account_email is null then raise exception 'Sign in with a confirmed email first'; end if;
 select i.* into invitation from public.team_invites i join public.teams t on t.id=i.team_id
 where i.token=invite_token and t.archived_at is null for update of i;
 if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'Invitation is invalid or expired'; end if;
 if lower(account_email)<>lower(invitation.email) then raise exception 'Sign in using the invited email address'; end if;
 insert into public.team_members(team_id,user_id,email,role) values(invitation.team_id,auth.uid(),invitation.email,'member') on conflict(team_id,user_id) do nothing;
 update public.team_invites set accepted_at=now(),requested_by=auth.uid(),requested_at=coalesce(requested_at,now()) where id=invitation.id;
 return invitation.team_id;
end $$;
-- Retain historical approval records, but retire the approval endpoint.
revoke all on function public.review_registration(uuid,boolean) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
