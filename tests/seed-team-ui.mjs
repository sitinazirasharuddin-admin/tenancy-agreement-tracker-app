import { createClient } from "@supabase/supabase-js";
const db = createClient("http://127.0.0.1:54322", "local-test-only");
const check = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
check(
  await db.auth.signInWithPassword({
    email: "alice@example.com",
    password: "local-test-only",
  }),
);
const team = check(
  await db.rpc("create_team", { team_name: "02 DATA Leasing" }),
);
const property = check(
  await db
    .from("properties")
    .insert({ name: "Menara Millenium", team_id: team })
    .select()
    .single(),
);
const unit = check(
  await db
    .from("units")
    .insert({ property_id: property.id, unit_number: "12-03", team_id: team })
    .select()
    .single(),
);
const tenant = check(
  await db
    .from("tenants")
    .insert({ name: "Sample Team Tenant", team_id: team })
    .select()
    .single(),
);
const ta = check(
  await db
    .from("tenancy_agreements")
    .insert({
      ta_reference: "TA-TEAM-018",
      property_id: property.id,
      unit_id: unit.id,
      tenant_id: tenant.id,
      team_id: team,
      person_in_charge: "Sample Admin",
      signing_date: "2026-09-30",
      status: "signed",
    })
    .select()
    .single(),
);
check(
  await db
    .from("outstanding_actions")
    .insert({
      ta_id: ta.id,
      team_id: team,
      action_type: "stamping",
      description: "Submit sample agreement for stamping",
    })
    .select()
    .single(),
);
console.log(
  "Seeded local synthetic private team and signed agreement for UI completion check.",
);
