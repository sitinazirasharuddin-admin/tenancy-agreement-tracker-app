import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { prepareManualAgreement } from "../lib/data/manual.ts";

test("manual tenant/unit entry reuses matches only within the selected property", () => {
  const store = {
    properties: [],
    tenants: [{ id: "t", name: "Contact", company_name: "Acme" }],
    units: [{ id: "u", property_id: "p1", unit_number: "G-01" }],
    tenancy_agreements: [],
    outstanding_actions: [],
  };
  const plan = prepareManualAgreement(
    { tenant_name: " acme ", unit_number: "g-01", property_id: "p1" },
    store,
  );
  assert.equal(plan.row.tenant_id, "t");
  assert.equal(plan.row.unit_id, "u");
  assert.equal(plan.createTenant, false);
  assert.equal(plan.createUnit, false);
  assert.equal("tenant_name" in plan.row, false);
  assert.equal("unit_number" in plan.row, false);
  const fresh = prepareManualAgreement(
    { tenant_name: "New Tenant", unit_number: "G-01", property_id: "p2" },
    store,
  );
  assert.equal(fresh.createTenant, true);
  assert.equal(fresh.createUnit, true);
  assert.equal(fresh.unit.property_id, "p2");
  assert.throws(
    () => prepareManualAgreement({ tenant_name: " ", unit_number: "1" }, store),
    /Enter the tenant/,
  );
  assert.throws(
    () =>
      prepareManualAgreement({ tenant_name: "Acme", unit_number: " " }, store),
    /Enter the unit/,
  );
  assert.throws(
    () =>
      prepareManualAgreement(
        { tenant_name: "Acme", unit_number: "1" },
        { ...store, tenants: [...store.tenants, { id: "t2", name: "Acme" }] },
      ),
    /More than one tenant/,
  );
});
import {
  stampingDue,
  overdue,
  urgency,
  missingWorkflowDetails,
} from "../lib/data/domain.ts";

test("guided workflow collects missing details and accepts zero fees and N/A payment", () => {
  assert.deepEqual(missingWorkflowDetails({}, "pending_signing"), []);
  assert.deepEqual(missingWorkflowDetails({}, "signed"), ["signing_date"]);
  assert.deepEqual(
    missingWorkflowDetails(
      { signing_date: "2026-09-30" },
      "stamping_submitted",
    ),
    ["stamping_submission_date", "stamping_fee"],
  );
  const stamped = {
    signing_date: "2026-09-30",
    stamping_submission_date: "2026-09-30",
    stamping_fee: 0,
    payment_status: "pending",
  };
  assert.deepEqual(missingWorkflowDetails(stamped, "payment_pending"), []);
  assert.deepEqual(missingWorkflowDetails(stamped, "completed"), [
    "payment_status",
  ]);
  assert.deepEqual(
    missingWorkflowDetails({ ...stamped, payment_status: "na" }, "completed"),
    [],
  );
  assert.deepEqual(
    missingWorkflowDetails({ ...stamped, payment_status: "paid" }, "completed"),
    [],
  );
});

test("configurable submission days, including leap year and year boundary", () => {
  assert.equal(stampingDue("2024-02-20"), "2024-03-05");
  assert.equal(stampingDue("2026-12-25"), "2027-01-08");
  assert.equal(stampingDue(null), null);
  assert.equal(stampingDue("2026-09-22"), "2026-10-06");
  assert.equal(stampingDue("2026-09-22", 21), "2026-10-13");
  assert.throws(() => stampingDue("2026-09-22", 1.5), /whole number/);
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
    for (const name of [
      "0001_init.sql",
      "0002_workflow_integrity.sql",
      "0006_configurable_stamping_due.sql",
    ])
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
    assert.equal(signed.rows[0].due, null);
    await db.query(
      "update tenancy_agreements set stamping_submission_date='2026-09-22', stamping_due_days=21 where id=$1",
      [id],
    );
    assert.equal(
      (
        await db.query(
          "select stamping_due_date::text as due from tenancy_agreements where id=$1",
          [id],
        )
      ).rows[0].due,
      "2026-10-13",
    );
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
