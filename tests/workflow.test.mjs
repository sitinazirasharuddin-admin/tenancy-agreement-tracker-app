import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { stampingDue, overdue, urgency } from "../lib/data/domain.ts";

test("30 calendar days, including leap year and year boundary", () => {
  assert.equal(stampingDue("2024-02-01"), "2024-03-02");
  assert.equal(stampingDue("2026-12-15"), "2027-01-14");
  assert.equal(stampingDue(null), null);
});
test("stamping flags and urgency distinguish completed stamping and due boundaries", () => {
  const ta = { id: "ta", status: "signed", stamping_due_date: "2026-09-29" };
  assert.equal(overdue(ta, "2026-09-30"), true);
  assert.equal(
    overdue({ ...ta, status: "payment_pending" }, "2026-09-30"),
    false,
  );
  assert.equal(
    urgency(
      { id: "a", due_date: "2026-09-29", priority: "high" },
      ta,
      "2026-09-30",
    ),
    85,
  );
  assert.equal(
    urgency(
      { id: "a", due_date: "2026-10-03", priority: "medium" },
      undefined,
      "2026-09-30",
    ),
    35,
  );
  assert.equal(
    urgency(
      { id: "a", due_date: "2026-10-07", priority: "low" },
      undefined,
      "2026-09-30",
    ),
    15,
  );
});
test("real Postgres migrations support the complete PRD scenario and preserve integrity", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';`,
    );
    for (const name of ["0001_init.sql", "0002_workflow_integrity.sql"])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const count = await db.query(
      "select count(*)::int as n from tenancy_agreements",
    );
    assert.equal(count.rows[0].n, 5);
    const result = await db.query(
      `insert into tenancy_agreements(ta_reference,property_id,unit_id,tenant_id,person_in_charge) values ('TA-2024-018','a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Nadia Hassan') returning id`,
    );
    const id = result.rows[0].id;
    await db.query(
      `update tenancy_agreements set status='pending_signing' where id=$1`,
      [id],
    );
    await db.query(
      `update tenancy_agreements set signing_date='2026-09-30',status='signed' where id=$1`,
      [id],
    );
    const signed = await db.query(
      "select stamping_due_date::text as due from tenancy_agreements where id=$1",
      [id],
    );
    assert.equal(signed.rows[0].due, "2026-10-30");
    await db.query(
      `insert into outstanding_actions(ta_id,action_type,description,due_date) values ($1,'stamping','Submit to LHDN','2026-10-30')`,
      [id],
    );
    await assert.rejects(
      db.query(`update tenancy_agreements set status='completed' where id=$1`, [
        id,
      ]),
      /Complete signing/,
    );
    await db.query(
      `update tenancy_agreements set stamping_submission_date='2026-10-01',stamping_fee=1250,payment_status='paid',status='completed' where id=$1`,
      [id],
    );
    const open = await db.query(
      "select count(*)::int as n from outstanding_actions where ta_id=$1 and not completed",
      [id],
    );
    assert.equal(open.rows[0].n, 0);
    const logs = await db.query(
      "select count(*)::int as n from audit_logs where target_id=$1",
      [id],
    );
    assert.ok(logs.rows[0].n >= 4);
    await assert.rejects(
      db.query(
        `update tenancy_agreements set unit_id='b0000000-0000-4000-8000-000000000003' where id=$1`,
        [id],
      ),
      /Unit must belong/,
    );
    await assert.rejects(
      db.query(
        `update tenancy_agreements set commencement_date='2027-01-01',expiry_date='2026-01-01' where id=$1`,
        [id],
      ),
      /valid_lease_dates/,
    );
    await assert.rejects(
      db.query(
        `insert into outstanding_actions(ta_id,action_type,description) values ($1,'filing','New action')`,
        [id],
      ),
      /Reopen the agreement/,
    );
    await db.query("delete from tenancy_agreements where id=$1", [id]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from outstanding_actions where ta_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("delete from audit_logs"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
