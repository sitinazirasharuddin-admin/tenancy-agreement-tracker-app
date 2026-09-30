import type { Row, Store } from "./domain";

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export function prepareManualAgreement(input: Partial<Row>, store: Store) {
  const tenantName = String(input.tenant_name ?? "").trim();
  const unitNumber = String(input.unit_number ?? "").trim();
  if (!tenantName) throw new Error("Enter the tenant name.");
  if (!unitNumber) throw new Error("Enter the unit number.");
  const tenants = store.tenants.filter(
    (t) => normalize(t.company_name || t.name) === normalize(tenantName),
  );
  const units = store.units.filter(
    (u) =>
      u.property_id === input.property_id &&
      normalize(u.unit_number) === normalize(unitNumber),
  );
  if (tenants.length > 1)
    throw new Error(
      "More than one tenant has this name. Give those tenant records distinct names in Tenants before saving.",
    );
  if (units.length > 1)
    throw new Error(
      "More than one unit has this number in the selected property. Resolve the duplicate units in Properties before saving.",
    );
  const tenant: Row = tenants[0] ?? { id: "new-tenant", name: tenantName };
  const unit: Row = units[0] ?? {
    id: "new-unit",
    unit_number: unitNumber,
    property_id: input.property_id ?? null,
  };
  const row: Partial<Row> = {
    ...input,
    tenant_id: tenant.id,
    unit_id: unit.id,
  };
  delete row.tenant_name;
  delete row.unit_number;
  return {
    row,
    tenant,
    unit,
    createTenant: !tenants.length,
    createUnit: !units.length,
    validationStore: {
      ...store,
      tenants: [...store.tenants, ...(tenants.length ? [] : [tenant])],
      units: [...store.units, ...(units.length ? [] : [unit])],
    },
  };
}
