export const statuses = [
  "preparation",
  "pending_signing",
  "signed",
  "stamping_submitted",
  "stamping_completed",
  "payment_pending",
  "completed",
] as const;
export type Row = {
  id: string;
  [key: string]: string | number | boolean | null;
};
export type Table =
  | "tenancy_agreements"
  | "properties"
  | "units"
  | "tenants"
  | "outstanding_actions";
export type Store = Record<Table, Row[]>;
export function missingWorkflowDetails(
  row: Partial<Row>,
  next: string,
): string[] {
  const missing: string[] = [];
  if (
    statuses.indexOf(next as (typeof statuses)[number]) >=
      statuses.indexOf("signed") &&
    !row.signing_date
  )
    missing.push("signing_date");
  if (
    statuses.indexOf(next as (typeof statuses)[number]) >=
    statuses.indexOf("stamping_submitted")
  ) {
    if (!row.stamping_submission_date) missing.push("stamping_submission_date");
    if (
      row.stamping_fee === null ||
      row.stamping_fee === undefined ||
      row.stamping_fee === ""
    )
      missing.push("stamping_fee");
  }
  if (
    next === "completed" &&
    !["paid", "na"].includes(String(row.payment_status))
  )
    missing.push("payment_status");
  return missing;
}
export const emptyStore: Store = {
  tenancy_agreements: [],
  properties: [],
  units: [],
  tenants: [],
  outstanding_actions: [],
};
export function label(value: unknown) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function stampingDue(signing: unknown) {
  if (!signing) return null;
  const date = new Date(`${signing}T00:00:00Z`);
  if (Number.isNaN(date.getTime()))
    throw new Error("Enter a valid signing date.");
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}
export function overdue(ta: Row, date = today()) {
  return (
    !!ta.stamping_due_date &&
    String(ta.stamping_due_date) < date &&
    !["stamping_completed", "payment_pending", "completed"].includes(
      String(ta.status),
    )
  );
}
export function urgency(action: Row, ta?: Row, date = today()) {
  if (action.completed) return 0;
  const days = action.due_date
    ? (Date.parse(String(action.due_date)) - Date.parse(date)) / 86400000
    : Infinity;
  return (
    (days < 0 ? 50 : days <= 3 ? 30 : days <= 7 ? 15 : 0) +
    (action.priority === "high" ? 10 : action.priority === "medium" ? 5 : 0) +
    (ta && overdue(ta, date) ? 25 : 0)
  );
}
export function validateAgreement(row: Partial<Row>, store: Store) {
  if (!String(row.ta_reference ?? "").trim())
    throw new Error("Agreement reference is required.");
  if (
    store.tenancy_agreements.some(
      (t) =>
        t.id !== row.id &&
        String(t.ta_reference).toLowerCase() ===
          String(row.ta_reference).trim().toLowerCase(),
    )
  )
    throw new Error("This agreement reference already exists.");
  if (!store.tenants.some((t) => t.id === row.tenant_id))
    throw new Error("Choose a tenant.");
  if (!store.properties.some((p) => p.id === row.property_id))
    throw new Error("Choose a property.");
  if (
    !store.units.some(
      (u) => u.id === row.unit_id && u.property_id === row.property_id,
    )
  )
    throw new Error("Choose a unit belonging to this property.");
  if (
    row.expiry_date &&
    row.commencement_date &&
    row.expiry_date < row.commencement_date
  )
    throw new Error("Expiry date must be on or after commencement date.");
  if (
    row.stamping_fee !== null &&
    row.stamping_fee !== undefined &&
    (!Number.isFinite(Number(row.stamping_fee)) || Number(row.stamping_fee) < 0)
  )
    throw new Error("Stamping fee must be a non-negative amount.");
  if (
    row.status === "completed" &&
    (!row.signing_date ||
      !row.stamping_submission_date ||
      row.stamping_fee === null ||
      row.stamping_fee === "" ||
      !["paid", "na"].includes(String(row.payment_status)))
  )
    throw new Error(
      "Before completing, enter the signing date, stamping submission date and fee, and mark payment paid or N/A.",
    );
}
