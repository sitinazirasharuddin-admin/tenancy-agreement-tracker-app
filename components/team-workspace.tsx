"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  listTeams,
  myRegistrations,
  teamPeople,
  teamRpc,
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
  const [requests, setRequests] = useState<Invite[]>([]);
  async function refreshTeams(id: string) {
    const result = await listTeams(id);
    setRequests(await myRegistrations(id));
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
      setMode("signup");
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
        setRequests([]);
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
      if (
        mode === "signup" &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          inviteCode.trim(),
        )
      )
        throw new Error(
          "Enter the invitation code shared by your administrator.",
        );
      const result =
        mode === "signup"
          ? await db.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin + "/auth/callback",
                data: { invitation_token: inviteCode.trim() },
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
      if (result.error)
        throw new Error(
          mode === "signup"
            ? "Registration could not be completed. Use the invited email and a valid, unused invitation code. Contact your admin if the invitation expired."
            : result.error.message,
        );
      if (mode === "signup") {
        setNotice(
          "Check your email to confirm your account. Your administrator must approve your registration before you can access the workspace.",
        );
        sessionStorage.removeItem("tenancy-invite");
      }
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
      setNotice(
        "Request submitted. Your administrator must approve access before you can enter the workspace.",
      );
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
            <span>INVITATION-ONLY ACCESS</span>
            {[
              "Receive an administrator invitation",
              "Register and confirm your email",
              "Wait for administrator approval",
            ].map((step, i) => (
              <div key={step}>
                <b>0{i + 1}</b>
                <p>{step}</p>
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
                ? "Invitation only. Confirm your email, then wait for administrator approval."
                : mode === "reset"
                  ? "We’ll email a secure reset link."
                  : "Sign in to your team’s private workspace."}
            </p>
            {feedback}
            <form onSubmit={authSubmit}>
              {mode === "signup" && (
                <label>
                  Invitation code
                  <input
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Code provided by your administrator"
                  />
                </label>
              )}
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
                    Register with invitation
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
            <p className="muted">
              Internal use only. Access requires an invitation and admin
              approval.
            </p>
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
                  Refresh registrations & members
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
                <h2>Invitations & registration approvals</h2>
                <p className="muted">
                  Create a link for their email address, then share it with
                  them. After registration and email confirmation, approve their
                  request below. Links expire after seven days.
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
                    {invite.requested_by && (
                      <>
                        <p>
                          Registration pending approval · Applicant must confirm
                          their email first.
                        </p>
                        <div className="row-actions">
                          <button
                            className="primary"
                            disabled={
                              busy || new Date(invite.expires_at) < new Date()
                            }
                            onClick={() =>
                              void run(async () => {
                                await teamRpc("review_registration", {
                                  invite_id: invite.id,
                                  approve: true,
                                });
                                await refreshPeople();
                                setNotice(
                                  "Registration approved. The member can now access this workspace.",
                                );
                              })
                            }
                          >
                            Approve registration
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await teamRpc("review_registration", {
                                  invite_id: invite.id,
                                  approve: false,
                                });
                                await refreshPeople();
                                setNotice(
                                  "Registration rejected. No workspace access granted.",
                                );
                              })
                            }
                          >
                            Reject registration
                          </button>
                        </div>
                      </>
                    )}
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
            {!teams.length && (
              <div className="onboard-note">
                Access is restricted. Registration does not grant access until
                an administrator approves it.
              </div>
            )}
            <div className="onboard-grid">
              <section className="panel onboarding">
                <h2>Registration status</h2>
                {requests.length ? (
                  requests.map((request) => (
                    <p key={request.id}>
                      {request.email}:{" "}
                      {request.revoked_at
                        ? "Rejected or revoked — contact your administrator"
                        : request.accepted_at
                          ? "Approved"
                          : new Date(request.expires_at) < new Date()
                            ? "Expired — request a new invitation"
                            : "Pending admin approval"}
                    </p>
                  ))
                ) : (
                  <p>
                    No registration request yet. Use your invitation code to
                    request access.
                  </p>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await refreshTeams(user.id);
                    })
                  }
                >
                  Check approval status
                </button>
              </section>
              <section className="panel onboarding">
                <h2>Request access with an invitation</h2>
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
                  <button disabled={busy}>Request admin approval</button>
                </form>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
