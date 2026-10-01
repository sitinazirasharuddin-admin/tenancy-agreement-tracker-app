import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const admin = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  applicant = "10000000-0000-4000-8000-000000000003",
  rejected = "10000000-0000-4000-8000-000000000004";
test("internal access requires matching invitation, confirmed email and separate administrator approval", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;
  grant usage on schema auth to anon,authenticated,supabase_auth_admin; grant insert,select on auth.users to supabase_auth_admin;
  insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.com',now()),('${other}','other@example.com',now());`);
    for (const file of [
      "0001_init.sql",
      "0002_workflow_integrity.sql",
      "0003_team_workspaces.sql",
      "0004_archive_team.sql",
      "0005_submission_checklist.sql",
      "0006_configurable_stamping_due.sql",
      "0007_rental_and_area.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "grant select,insert,update,delete on public.properties,public.units,public.tenants,public.tenancy_agreements,public.outstanding_actions,public.audit_logs to anon,authenticated",
    );
    const as = async (id, email) => {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",
        [id ?? "", email ?? ""],
      );
      await db.exec("set role " + (id ? "authenticated" : "anon"));
    };
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    await as(admin, "admin@example.com");
    const team = (await one("select create_team('Internal team') as id")).id;
    const property = (
      await one(
        "insert into properties(name,team_id) values('Private property',$1) returning id",
        [team],
      )
    ).id;
    await as(other, "other@example.com");
    await one("select create_team('Other team') as id");
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0008_invitation_approval.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await as(null, null);
    for (const table of [
      "properties",
      "units",
      "tenants",
      "tenancy_agreements",
      "outstanding_actions",
      "audit_logs",
    ])
      await assert.rejects(
        db.query(`select * from ${table}`),
        /permission denied/,
      );
    await as(admin, "admin@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 1);
    await assert.rejects(db.query("select create_team('Bypass')"), /disabled/);
    const token = (
      await one("select invite_team_member($1,'new@example.com') as token", [
        team,
      ])
    ).token;
    const invitation = (
      await one("select id from team_invites where token=$1", [token])
    ).id;
    // Exercise trigger with auth-service privileges, not the business-data role.
    await db.exec("reset role;set role supabase_auth_admin");
    await assert.rejects(
      db.query(
        "insert into auth.users(id,email) values($1,'outsider@example.com')",
        [applicant],
      ),
      /valid administrator invitation/,
    );
    await assert.rejects(
      db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,'wrong@example.com',$2)",
        [applicant, JSON.stringify({ invitation_token: token })],
      ),
      /valid administrator invitation/,
    );
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.com',$2)",
      [applicant, JSON.stringify({ invitation_token: token, role: "admin" })],
    );
    await as(applicant, "new@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 0);
    assert.equal((await one("select count(*)::int as n from teams")).n, 0);
    assert.equal(
      (await one("select count(*)::int as n from team_invites")).n,
      1,
    );
    await assert.rejects(
      db.query("insert into properties(name,team_id) values('Bypass',$1)", [
        team,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select review_registration($1,true)", [invitation]),
      /Only team admins/,
    );
    await assert.rejects(
      db.query("select accept_team_invite($1)", [token]),
      /Confirm your email/,
    );
    await assert.rejects(
      db.query(
        "insert into team_members(team_id,user_id,email,role) values($1,$2,'new@example.com','admin')",
        [team, applicant],
      ),
      /permission denied/,
    );
    await as(other, "other@example.com");
    await assert.rejects(
      db.query("select review_registration($1,true)", [invitation]),
      /Only team admins/,
    );
    await as(admin, "admin@example.com");
    await assert.rejects(
      db.query("select review_registration($1,true)", [invitation]),
      /confirm the invited email/,
    );
    await db.exec("reset role");
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [applicant],
    );
    await as(applicant, "new@example.com");
    await db.query("select accept_team_invite($1)", [token]);
    assert.equal((await one("select count(*)::int as n from properties")).n, 0);
    await as(admin, "admin@example.com");
    await db.query("select review_registration($1,true)", [invitation]);
    await assert.rejects(
      db.query("select review_registration($1,true)", [invitation]),
      /No pending/,
    );
    await as(applicant, "new@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 1);
    assert.equal(
      (await one("select role from team_members where user_id=$1", [applicant]))
        .role,
      "member",
    );
    await db.query(
      "update properties set address='Allowed after approval' where id=$1",
      [property],
    );
    await assert.rejects(
      db.query("select invite_team_member($1,$2)", [
        team,
        "blocked@example.com",
      ]),
      /Only team admins/,
    );
    await as(admin, "admin@example.com");
    const token2 = (
      await one("select invite_team_member($1,'reject@example.com') as token", [
        team,
      ])
    ).token;
    const invite2 = (
      await one("select id from team_invites where token=$1", [token2])
    ).id;
    await db.exec("reset role;set role supabase_auth_admin");
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'reject@example.com',now(),$2)",
      [rejected, JSON.stringify({ invitation_token: token2 })],
    );
    await as(admin, "admin@example.com");
    await db.query("select review_registration($1,false)", [invite2]);
    await as(rejected, "reject@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 0);
    await assert.rejects(
      db.query("select accept_team_invite($1)", [token2]),
      /invalid or expired/,
    );
    await as(admin, "admin@example.com");
    await db.query("select manage_team_member($1,$2,null)", [team, applicant]);
    await as(applicant, "new@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 0);
    await as(admin, "admin@example.com");
    const expired = (
      await one(
        "select invite_team_member($1,'expired@example.com') as token",
        [team],
      )
    ).token;
    await db.exec("reset role");
    await db.query(
      "update team_invites set expires_at=now()-interval '1 day' where token=$1",
      [expired],
    );
    await db.exec("set role supabase_auth_admin");
    await assert.rejects(
      db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'expired@example.com',$1)",
        [JSON.stringify({ invitation_token: expired })],
      ),
      /valid administrator invitation/,
    );
    await as(other, "other@example.com");
    assert.equal((await one("select count(*)::int as n from properties")).n, 0);
  } finally {
    await db.close();
  }
});
