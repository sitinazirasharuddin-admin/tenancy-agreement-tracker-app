"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  listTeams,
  teamPeople,
  teamRpc,
  portfolioNames,
  type Team,
  type Member,
  type Invite,
} from "@/lib/teams";
import Tracker from "./tracker";
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
    setSelected((previous) =>
      previous ? (result.find((t) => t.id === previous.id) ?? null) : null,
    );
    return result;
  }
  useEffect(() => {
    const db = createClient();
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const pendingInvite =
      params.get("invite") ?? sessionStorage.getItem("tenancy-invite") ?? "";
    setInviteCode(pendingInvite);
    if (pendingInvite) sessionStorage.setItem("tenancy-invite", pendingInvite);
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
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? "");
    await run(async () => {
      const db = createClient();
      const result =
        mode === "signup"
          ? await db.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin + "/auth/callback",
              },
            })
          : mode === "reset"
            ? await db.auth.resetPasswordForEmail(email, {
                redirectTo:
                  window.location.origin + "/auth/callback?recovery=1",
              })
            : mode === "password"
              ? await db.auth.updateUser({ password })
              : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup")
        setNotice("Check your email to confirm your account, then sign in.");
      if (mode === "reset")
        setNotice(
          "If this account exists, a password reset link has been sent.",
        );
      if (mode === "password") {
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
  async function createTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const id = await teamRpc("create_team", {
        team_name: String(form.get("name") ?? ""),
      });
      if (form.get("portfolio")) {
        const { error } = await createClient()
          .from("properties")
          .insert(portfolioNames.map((name) => ({ name, team_id: id })));
        if (error) {
          await refreshTeams(user!.id);
          throw new Error(
            "Team created. Property setup failed: " + error.message,
          );
        }
      }
      const result = await refreshTeams(user!.id);
      setSelected(result.find((t) => t.id === id) ?? null);
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
      setSelected(result.find((t) => t.id === id) ?? null);
      setInviteCode("");
      sessionStorage.removeItem("tenancy-invite");
      window.history.replaceState({}, "", window.location.pathname);
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
  if (!user || mode === "password")
    return (
      <div className="auth-shell">
        <section className="auth-story">
          <a href="/" className="auth-brand">
            ▦ Tenancy<span>TEAM WORKSPACE</span>
          </a>
          <p className="eyebrow">ONE TEAM. EVERY AGREEMENT.</p>
          <h1>
            A clearer way
            <br />
            to lease together.
          </h1>
          <p>
            From the first draft to the final stamp, give your team one place to
            move work forward.
          </p>
          <div className="auth-preview">
            <span>YOUR PORTFOLIO</span>
            {portfolioNames.map((name, i) => (
              <div key={name}>
                <b>0{i + 1}</b>
                <p>
                  {name}
                  <small>Agreements · units · follow-ups</small>
                </p>
                <span>↗</span>
              </div>
            ))}
          </div>
          <small>Private workspaces. Shared progress. Clear ownership.</small>
        </section>
        <section className="auth-form-area">
          <div className="auth-form">
            <span className="tag">BUILT FOR LEASING TEAMS</span>
            <h2>
              {mode === "signup"
                ? "Create your account"
                : mode === "reset"
                  ? "Reset your password"
                  : mode === "password"
                    ? "Choose a new password"
                    : "Welcome back"}
            </h2>
            <p className="muted">
              {mode === "signup"
                ? "Start a private workspace or accept a team invitation."
                : mode === "reset"
                  ? "We’ll email a secure reset link."
                  : "Sign in to your team’s private workspace."}
            </p>
            {feedback}
            <form onSubmit={authSubmit}>
              {mode !== "password" && (
                <label>
                  Email address
                  <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Password
                  <input
                    required
                    type="password"
                    name="password"
                    minLength={8}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="At least 8 characters"
                  />
                </label>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : mode === "password"
                        ? "Save password"
                        : "Sign in →"}
              </button>
            </form>
            <div className="auth-links">
              {mode === "login" ? (
                <>
                  <button
                    className="link"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setNotice("");
                    }}
                  >
                    Create an account
                  </button>
                  <button className="link" onClick={() => setMode("reset")}>
                    Forgot password?
                  </button>
                </>
              ) : (
                <button className="link" onClick={() => setMode("login")}>
                  Back to sign in
                </button>
              )}
            </div>
            <div className="auth-demo">
              <a href="/demo">Explore the sample workspace ↗</a>
              <small>No login needed. Sample data only.</small>
            </div>
          </div>
        </section>
      </div>
    );
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
          onSwitchTeam={() => setSelected(null)}
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
                <span className="badge">{members.length} members</span>
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
            {selected.role === "admin" && (
              <section className="panel invite-panel">
                <h2>Invite a teammate</h2>
                <p className="muted">
                  Create a link for their email address, then share it with
                  them. Links expire after seven days.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      await teamRpc("invite_team_member", {
                        team: selected.id,
                        invite_email: String(f.get("email")),
                      });
                      await refreshPeople();
                      setNotice(
                        "Invitation created. Copy its link and share it with your teammate.",
                      );
                    });
                  }}
                  className="invite-form"
                >
                  <label>
                    Teammate’s email
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="colleague@company.com"
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Create invitation
                  </button>
                </form>
                {invites.map((invite) => (
                  <div className="invitation" key={invite.id}>
                    <strong>{invite.email}</strong>
                    <small>
                      {new Date(invite.expires_at) < new Date()
                        ? "Expired"
                        : "Expires " +
                          new Date(invite.expires_at).toLocaleDateString()}
                    </small>
                    <input
                      aria-label={`Invitation link for ${invite.email}`}
                      readOnly
                      value={`${typeof window === "undefined" ? "" : window.location.origin}/?invite=${invite.token}`}
                    />
                    <div className="row-actions">
                      <button
                        onClick={() =>
                          void run(async () => {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/?invite=${invite.token}`,
                            );
                            setNotice("Invitation link copied.");
                          })
                        }
                      >
                        Copy link
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await teamRpc("revoke_team_invite", {
                              invite_id: invite.id,
                            });
                            await refreshPeople();
                          })
                        }
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
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
                    setSelected(team);
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
            {!teams.length && (
              <div className="onboard-note">
                You’re ready to begin. Create your team below, or use an
                invitation to join an existing team.
              </div>
            )}
            <div className="onboard-grid">
              <section className="panel onboarding">
                <h2>Create a team workspace</h2>
                <form onSubmit={createTeam}>
                  <label>
                    Team name
                    <input
                      required
                      name="name"
                      minLength={2}
                      maxLength={80}
                      placeholder="Leasing team"
                    />
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="portfolio" defaultChecked />
                    Add the three property folders from your portfolio
                  </label>
                  <p className="muted">{portfolioNames.join(" · ")}</p>
                  <button className="primary" disabled={busy}>
                    {busy ? "Creating…" : "Create workspace →"}
                  </button>
                </form>
              </section>
              <section className="panel onboarding">
                <h2>Join an existing team</h2>
                <p className="muted">
                  Use the invitation code shared by your admin. Sign in with the
                  email they invited.
                </p>
                <form onSubmit={acceptInvite}>
                  <label>
                    Invitation code
                    <input
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Paste your invitation code"
                    />
                  </label>
                  <button disabled={busy}>Join team</button>
                </form>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
