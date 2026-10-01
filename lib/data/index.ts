import { createClient } from "@/lib/supabase/client";
import { prepareManualAgreement } from "./manual";
import {
  emptyStore,
  stampingDue,
  validateAgreement,
  type Row,
  type Store,
  type Table,
} from "./domain";
function db() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    throw new Error(
      "Database connection is not configured. Pull the project environment from Vercel and restart the app.",
    );
  return createClient();
}
export async function loadStore(teamId?: string): Promise<Store> {
  const entries = await Promise.all(
    (Object.keys(emptyStore) as Table[]).map(async (table) => {
      let query = db()
        .from(table)
        .select("*")
        .order("created_at", { ascending: false });
      query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);
      const { data, error } = await query;
      if (error)
        throw new Error(
          `Unable to load ${table.replaceAll("_", " ")}: ${error.message}`,
        );
      return [table, data ?? []];
    }),
  );
  return Object.fromEntries(entries) as Store;
}
export async function saveRow(
  table: Table,
  input: Partial<Row>,
  store: Store,
  teamId?: string,
) {
  const row: Partial<Row> = { ...input, team_id: teamId ?? null };
  delete row.created_at;
  delete row.user_id;
  if (table === "tenancy_agreements") {
    // A stale edit form must not overwrite a separately saved submission tick.
    delete row.submission_completed;
    validateAgreement(row, store);
    row.ta_reference = String(row.ta_reference).trim();
    row.stamping_due_date = stampingDue(
      row.stamping_submission_date,
      row.stamping_due_days ?? 14,
    );
  }
  if (table === "outstanding_actions")
    row.completed_at = row.completed ? new Date().toISOString() : null;
  const query = row.id
    ? db().from(table).update(row).eq("id", row.id)
    : db().from(table).insert(row);
  const { data, error } = await query.select().single();
  if (error)
    throw new Error(`Failed to save — check connection. ${error.message}`);
  return data as Row;
}
export async function setSubmissionCompleted(
  id: string,
  completed: boolean,
  teamId?: string,
) {
  let query = db()
    .from("tenancy_agreements")
    .update({ submission_completed: completed })
    .eq("id", id);
  query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);
  const { data, error } = await query
    .select("id, submission_completed")
    .single();
  if (error)
    throw new Error(`Unable to save submission tick. ${error.message}`);
  return data;
}

export async function saveManualAgreement(
  input: Partial<Row>,
  teamId?: string,
) {
  // Reload scoped records so a retry reuses any tenant/unit created by a prior attempt.
  const store = await loadStore(teamId);
  const plan = prepareManualAgreement(input, store);
  // Validate all agreement fields before creating its related records.
  validateAgreement(plan.row, plan.validationStore);
  if (plan.createTenant) {
    const tenant = await saveRow(
      "tenants",
      { name: plan.tenant.name },
      store,
      teamId,
    );
    store.tenants.push(tenant);
    plan.row.tenant_id = tenant.id;
  }
  if (plan.createUnit) {
    const unit = await saveRow(
      "units",
      { unit_number: plan.unit.unit_number, property_id: input.property_id },
      store,
      teamId,
    );
    store.units.push(unit);
    plan.row.unit_id = unit.id;
  }
  return saveRow("tenancy_agreements", plan.row, store, teamId);
}

export async function deleteRow(
  table: Table,
  id: string,
  store: Store,
  teamId?: string,
) {
  if (
    table === "properties" &&
    (store.units.some((r) => r.property_id === id) ||
      store.tenancy_agreements.some((r) => r.property_id === id))
  )
    throw new Error(
      "Remove linked units and agreements before deleting this property.",
    );
  if (
    table === "units" &&
    store.tenancy_agreements.some((r) => r.unit_id === id)
  )
    throw new Error("This unit is linked to an agreement.");
  if (
    table === "tenants" &&
    store.tenancy_agreements.some((r) => r.tenant_id === id)
  )
    throw new Error("This tenant is linked to an agreement.");
  let query = db().from(table).delete().eq("id", id);
  query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);
  const { error, data } = await query.select("id");
  if (error) throw new Error(`Failed to delete: ${error.message}`);
  if (!data?.length)
    throw new Error("Record was not deleted. Refresh and try again.");
}
