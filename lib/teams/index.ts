import { createClient } from "@/lib/supabase/client";
export type Team = { id: string; name: string; role: "admin" | "member" };
export type Member = {
  team_id: string;
  user_id: string;
  email: string;
  role: "admin" | "member";
};
export type Invite = {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
export const portfolioNames = [
  "Menara Millenium",
  "The five",
  "The Stories of Taman Tunku",
];
export async function listTeams(userId: string): Promise<Team[]> {
  const db = createClient();
  const [teams, members] = await Promise.all([
    db.from("teams").select("id,name").order("created_at"),
    db.from("team_members").select("team_id,role").eq("user_id", userId),
  ]);
  if (teams.error) throw teams.error;
  if (members.error) throw members.error;
  return (teams.data ?? []).map((t) => ({
    ...t,
    role: members.data?.find((m) => m.team_id === t.id)?.role ?? "member",
  }));
}
export async function teamPeople(teamId: string, admin: boolean) {
  const db = createClient();
  const members = await db
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at");
  if (members.error) throw members.error;
  const invites = admin
    ? await db
        .from("team_invites")
        .select("*")
        .eq("team_id", teamId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (invites.error) throw invites.error;
  return {
    members: members.data as Member[],
    invites: invites.data as Invite[],
  };
}
export async function teamRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw error;
  return data;
}
