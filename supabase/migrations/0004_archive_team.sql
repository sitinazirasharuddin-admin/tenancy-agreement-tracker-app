-- Preserve archived workspaces and their records, but hide them from the team picker.
-- Administrative restore: set archived_at = null for the specific team.
alter table public.teams add column archived_at timestamptz;
alter policy teams_read on public.teams
 using (archived_at is null and public.is_team_member(id));
