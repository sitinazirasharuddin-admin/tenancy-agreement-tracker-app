"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  listTeams,
  teamPeople,
  teamRpc,
  type Team,
  type Member,
  type Invite,
} from "@/lib/teams";
import Tracker from "./tracker";
import AuthPanel from "./auth-panel";
import AdminUsers, { ResetUserPassword } from "./admin-users";
import FirstPassword from "./first-password";
import { authErrorMessage } from "@/lib/auth-errors";
export default function TeamWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [teams, setTeams] = useState<Team[]>([]),
    [selected, setSelected] = useState<Team | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "password">(
      "login",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(false),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invite[]>([]),
    [inviteCode, setInviteCode] = useState("");
  async function refreshTeams(id: string) {
    const result = await listTeams(id);
    setTeams(result);
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(`tenancy-team:${id}`);
    } catch {
      /* Storage may be disabled. */
    }
    setSelected(
      (previous) =>
        result.find((t) => t.id === (previous?.id ?? remembered)) ?? null,
    );
    return result;
  }
  function chooseTeam(team: Team | null) {
    setSelected(team);
    if (!user) return;
    try {
      if (team) localStorage.setItem(`tenancy-team:${user.id}`, team.id);
      else localStorage.removeItem(`tenancy-team:${user.id}`);
    } catch {
      /* Team selection works even when browser storage is disabled. */
    }
  }
  useEffect(() => {
    const db = createClient();
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const pendingInvite =
      params.get("invite") ?? sessionStorage.getItem("tenancy-invite") ?? "";
    setInviteCode(pendingInvite);
    if (pendingInvite) {
      sessionStorage.setItem("tenancy-invite", pendingInvite);
      setMode("login");
    }
    if (params.get("recovery") === "1") setMode("password");
    if (params.get("auth_error"))
      setError(
        "The sign-in link could not be verified. Request a new link and try again.",
      );
    db.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      setUser(data.session?.user ?? null);
      try {
        if (data.session) await refreshTeams(data.session.user.id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (active) setReady(true);
      }
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("password");
      if (!session) {
        setTeams([]);
        setSelected(null);
        setSettings(false);
      } else if (event === "SIGNED_IN") {
        setTimeout(() => {
          if (active)
            void refreshTeams(session.user.id).catch((e) =>
              setError(e.message),
            );
        }, 0);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "signup") { setError("Ask your team administrator to create your account."); return; }
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? "");
    await run(async () => {
      const db = createClient();
      const result =
        mode === "reset"
            ? await db.auth.resetPasswordForEmail(email, {
                redirectTo:
                  window.location.origin + "/auth/callback?recovery=1",
              })
            : mode === "password"
              ? await db.auth.updateUser({ password })
              : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw new Error(authErrorMessage(result.error, mode));
      if (mode === "reset")
        setNotice(
          "If this account exists, a password reset link has been sent.",
        );
      if (mode === "password") {
        const url = new URL(window.location.href);
        url.searchParams.delete("recovery");
        url.searchParams.delete("auth_error");
        window.history.replaceState(
          {},
          "",
          url.pathname + url.search + url.hash,
        );
        setMode("login");
        setNotice("Password updated.");
      }
    });
  }
  async function signOut() {
    await run(async () => {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      setSelected(null);
      setUser(null);
      setSettings(false);
    });
  }
  async function openSettings() {
    if (!selected) return;
    await run(async () => {
      const result = await teamPeople(selected.id, selected.role === "admin");
      setMembers(result.members);
      setInvites(result.invites);
      setSettings(true);
    });
  }
  async function refreshPeople() {
    if (!selected) return;
    const result = await teamPeople(selected.id, selected.role === "admin");
    setMembers(result.members);
    setInvites(result.invites);
  }
  async function acceptInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const id = await teamRpc("accept_team_invite", {
        invite_token: inviteCode.trim(),
      });
      const result = await refreshTeams(user!.id);
      chooseTeam(result.find((t) => t.id === id) ?? null);
      setInviteCode("");
      sessionStorage.removeItem("tenancy-invite");
      window.history.replaceState({}, "", window.location.pathname);
      setNotice("You have joined the workspace.");
    });
  }
  const feedback = (
    <>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="alert success">
          {notice}
        </div>
      )}
    </>
  );
  if (!ready)
    return (
      <div className="auth-loading" role="status">
        Opening your workspace…
      </div>
    );
  if (user?.app_metadata.must_change_password) return <FirstPassword onSignOut={signOut} onDone={async()=>{const {data,error}=await createClient().auth.getUser();if(error)throw error;if(data.user?.app_metadata.must_change_password)throw new Error("Password change is not complete. Please try again.");setUser(data.user);if(data.user)await refreshTeams(data.user.id);}} />;
  if (!user || mode === "password") return <AuthPanel mode={mode} busy={busy} feedback={feedback} onSubmit={authSubmit} onMode={(next)=>{setMode(next);setError("");setNotice("");}} />;
  if (selected && !settings)
    return (
      <>
        <div className="team-feedback">{feedback}</div>
        <Tracker
          key={selected.id}
          teamId={selected.id}
          teamName={selected.name}
          teamRole={selected.role}
          onTeamSettings={() => void openSettings()}
          onSwitchTeam={() => chooseTeam(null)}
          onSignOut={() => void signOut()}
        />
      </>
    );
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <a href="/" className="workspace-logo">
          ▦ Tenancy
        </a>
        <div>
          <span>{user.email}</span>
          <button disabled={busy} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="workspace-content">
        {feedback}
        {selected && settings ? (
          <>
            <button className="link" onClick={() => setSettings(false)}>
              ← Back to agreements
            </button>
            <p className="eyebrow">WORKSPACE SETTINGS</p>
            <h1>{selected.name}</h1>
            <p className="muted">
              Members share this workspace’s agreements. Other teams cannot
              access them.
            </p>
            <section className="panel">
              <div className="panel-heading">
                <h2>Team members</h2>
                <button disabled={busy} onClick={() => void run(refreshPeople)}>
                  Refresh members
                </button>
              </div>
              {members.map((member) => (
                <div className="member-row" key={member.user_id}>
                  <span className="avatar">
                    {member.email.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="grow">
                    <strong>{member.email}</strong>
                    <small>
                      {member.user_id === user.id ? "You · " : ""}
                      {member.role === "admin"
                        ? "Workspace admin"
                        : "Team member"}
                    </small>
                  </div>
                  {selected.role === "admin" && member.user_id !== user.id && <ResetUserPassword teamId={selected.id} userId={member.user_id} />}
                  {selected.role === "admin" ? (
                    <>
                      <select
                        aria-label={`Role for ${member.email}`}
                        value={member.role}
                        disabled={busy}
                        onChange={(e) => {
                          const role = e.target.value;
                          void run(async () => {
                            await teamRpc("manage_team_member", {
                              team: selected.id,
                              member_id: member.user_id,
                              new_role: role,
                            });
                            await refreshTeams(user.id);
                            await refreshPeople();
                          });
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                      <button
                        disabled={busy}
                        className="danger"
                        onClick={() => {
                          if (confirm(`Remove ${member.email} from this team?`))
                            void run(async () => {
                              await teamRpc("manage_team_member", {
                                team: selected.id,
                                member_id: member.user_id,
                                new_role: null,
                              });
                              await refreshTeams(user.id);
                              await refreshPeople();
                            });
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="badge">{member.role}</span>
                  )}
                </div>
              ))}
            </section>
            {selected.role === "admin" && <AdminUsers teamId={selected.id} onCreated={refreshPeople} />}
          </>
        ) : (
          <>
            <p className="eyebrow">YOUR TEAMS</p>
            <h1>A workspace for every team.</h1>
            <p className="muted">
              Choose where to work. Each team has its own members, portfolio and
              agreements.
            </p>
            <div className="team-grid">
              {teams.map((team) => (
                <button
                  className="team-card"
                  key={team.id}
                  onClick={() => {
                    chooseTeam(team);
                    setSettings(false);
                    setError("");
                  }}
                >
                  <span className="team-icon">▦</span>
                  <span className="badge">{team.role}</span>
                  <h2>{team.name}</h2>
                  <p>
                    Open workspace <span>→</span>
                  </p>
                </button>
              ))}
            </div>
            {!teams.length && <p className="onboard-note">No active team access. Contact your administrator.</p>}
          </>
        )}
      </main>
    </div>
  );
}
