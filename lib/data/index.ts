import { createClient } from "@/lib/supabase/client";
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
    validateAgreement(row, store);
    row.ta_reference = String(row.ta_reference).trim();
    row.stamping_due_date = stampingDue(row.signing_date);
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
