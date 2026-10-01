import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002",
  eve = "10000000-0000-4000-8000-000000000003";
test("private teams enforce RLS, references, roles and invitation identity in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}'),('${eve}');create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''email'',current_setting(''request.jwt.claim.email'',true))';grant usage on schema auth to anon,authenticated;`,
    );
    for (const file of ["0001_init.sql", "0002_workflow_integrity.sql"])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "grant select,insert,update,delete on all tables in schema public to anon,authenticated",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0003_team_workspaces.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const file of [
      "0004_archive_team.sql",
      "0005_submission_checklist.sql",
      "0006_configurable_stamping_due.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
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
    await as(alice, "alice@example.com");
    const teamA = (await one("select create_team('Leasing A') as id")).id;
    const propertyA = (
      await one(
        "insert into properties(name,team_id) values('Private A',$1) returning id",
        [teamA],
      )
    ).id;
    const unitA = (
      await one(
        "insert into units(property_id,unit_number,team_id) values($1,'12-03',$2) returning id",
        [propertyA, teamA],
      )
    ).id;
    const tenantA = (
      await one(
        "insert into tenants(name,team_id) values('Sample tenant A',$1) returning id",
        [teamA],
      )
    ).id;
    const taA = await one(
      "insert into tenancy_agreements(ta_reference,team_id,property_id,unit_id,tenant_id) values('TA-TEAM-001',$1,$2,$3,$4) returning id,user_id",
      [teamA, propertyA, unitA, tenantA],
    );
    assert.equal(taA.user_id, alice);
    assert.equal(
      (
        await one(
          "select submission_completed from tenancy_agreements where id=$1",
          [taA.id],
        )
      ).submission_completed,
      false,
    );
    await db.query(
      "update tenancy_agreements set submission_completed=true where id=$1",
      [taA.id],
    );
    const ticked = await one(
      "select submission_completed,status,payment_status from tenancy_agreements where id=$1",
      [taA.id],
    );
    assert.deepEqual(ticked, {
      submission_completed: true,
      status: "preparation",
      payment_status: "pending",
    });

    await db.query(
      "update tenancy_agreements set signing_date='2026-09-30',status='signed' where id=$1",
      [taA.id],
    );
    await db.query(
      "insert into outstanding_actions(ta_id,team_id,action_type,description) values($1,$2,'stamping','Sample follow-up')",
      [taA.id, teamA],
    );
    await db.query(
      "update tenancy_agreements set stamping_submission_date='2026-09-30',stamping_fee=100,payment_status='paid',status='completed' where id=$1",
      [taA.id],
    );
    assert.equal(
      (
        await one(
          "select count(*)::int as n from outstanding_actions where ta_id=$1 and not completed",
          [taA.id],
        )
      ).n,
      0,
    );
    assert.ok(
      (
        await one(
          "select count(*)::int as n from audit_logs where team_id=$1",
          [teamA],
        )
      ).n >= 4,
    );
    // Reopening the submission checklist must not reopen a completed agreement.
    await db.query(
      "update tenancy_agreements set submission_completed=false where id=$1",
      [taA.id],
    );
    assert.deepEqual(
      await one(
        "select submission_completed,status from tenancy_agreements where id=$1",
        [taA.id],
      ),
      { submission_completed: false, status: "completed" },
    );
    const invitation = (
      await one("select invite_team_member($1,'bob@example.com') as token", [
        teamA,
      ])
    ).token;
    await assert.rejects(
      db.query("select manage_team_member($1,$2,'member')", [teamA, alice]),
      /retain at least one admin/,
    );
    await as(bob, "bob@example.com");
    const teamB = (await one("select create_team('Leasing B') as id")).id;
    const propertyB = (
      await one(
        "insert into properties(name,team_id) values('Private B',$1) returning id",
        [teamB],
      )
    ).id;
    assert.equal(
      (
        await one("select count(*)::int as n from properties where id=$1", [
          propertyA,
        ])
      ).n,
      0,
    );
    assert.equal(
      (
        await one(
          "select count(*)::int as n from audit_logs where team_id=$1",
          [teamA],
        )
      ).n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update properties set name=$1 where id=$2 returning id",
          ["Attacker", propertyA],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into units(property_id,unit_number,team_id) values($1,'Cross-team',$2)",
        [propertyA, teamB],
      ),
      /this workspace/,
    );
    await assert.rejects(
      db.query(
        "insert into properties(name,team_id) values('Unauthorized',$1)",
        [teamA],
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "update tenancy_agreements set submission_completed=true where id=$1 returning id",
          [taA.id],
        )
      ).rows.length,
      0,
    );
    await as(eve, "eve@example.com");
    await assert.rejects(
      db.query("select accept_team_invite($1)", [invitation]),
      /email address/,
    );
    await as(bob, "bob@example.com");
    await db.query("select accept_team_invite($1)", [invitation]);
    await db.query(
      "update tenancy_agreements set submission_completed=true where id=$1",
      [taA.id],
    );
    assert.equal(
      (
        await one(
          "select submission_completed from tenancy_agreements where id=$1",
          [taA.id],
        )
      ).submission_completed,
      true,
    );

    assert.equal(
      (
        await one("select count(*)::int as n from properties where id=$1", [
          propertyA,
        ])
      ).n,
      1,
    );
    await assert.rejects(
      db.query("select accept_team_invite($1)", [invitation]),
      /invalid or expired/,
    );
    await assert.rejects(
      db.query("select invite_team_member($1,'eve@example.com')", [teamA]),
      /Only team admins/,
    );
    await assert.rejects(
      db.query(
        "update team_members set role='admin' where team_id=$1 and user_id=$2",
        [teamA, bob],
      ),
      /permission denied/,
    );
    assert.equal(
      (
        await db.query(
          "delete from tenancy_agreements where id=$1 returning id",
          [taA.id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update properties set team_id=$1 where id=$2", [
        teamB,
        propertyA,
      ]),
      /cannot be moved/,
    );
    await as(null, null);
    assert.equal(
      (await one("select count(*)::int as n from tenancy_agreements")).n,
      5,
    );
    assert.equal(
      (
        await one("select count(*)::int as n from properties where id=$1", [
          propertyB,
        ])
      ).n,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into properties(name,team_id) values('Anon attack',$1)",
        [teamA],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into units(unit_number,property_id) values('Demo-to-private',$1)",
        [propertyA],
      ),
      /this workspace/,
    );
    await as(alice, "alice@example.com");
    await db.query("select manage_team_member($1,$2,null)", [teamA, bob]);
    await as(bob, "bob@example.com");
    assert.equal(
      (
        await one("select count(*)::int as n from properties where id=$1", [
          propertyA,
        ])
      ).n,
      0,
    );
  } finally {
    await db.close();
  }
});
