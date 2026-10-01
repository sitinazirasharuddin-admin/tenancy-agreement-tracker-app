"use client";
import { useState, type ReactNode } from "react";
import { label, type Row, type Store, type Table } from "@/lib/data/domain";

const text = (v: unknown) => String(v ?? "");
export default function PropertyFolders({
  store,
  busy,
  onEdit,
  onRemove,
  onOpenAgreement,
  photo,
}: {
  store: Store;
  busy: boolean;
  onEdit: (table: Table, row?: Partial<Row>) => void;
  onRemove: (table: Table, row: Row) => void;
  onOpenAgreement: (id: string) => void;
  photo: (name: unknown) => ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const property = store.properties.find((p) => p.id === selected);
  const units = store.units.filter((u) => u.property_id === property?.id);
  const agreements = store.tenancy_agreements.filter(
    (ta) => ta.property_id === property?.id,
  );
  const tenantName = (ta: Row) => {
    const tenant = store.tenants.find((t) => t.id === ta.tenant_id);
    return text(tenant?.company_name || tenant?.name || "Missing tenant");
  };
  const tenantList = (rows: Row[]) =>
    rows.length ? (
      <div className="property-tenant-list">
        {rows.map((ta) => (
          <div className="property-tenant" key={ta.id}>
            <strong>{tenantName(ta)}</strong>
            <button className="link" onClick={() => onOpenAgreement(ta.id)}>
              {text(ta.ta_reference)} →
            </button>
            <span className={`badge ${ta.status}`}>{label(ta.status)}</span>
          </div>
        ))}
      </div>
    ) : (
      <p className="muted">No tenant linked yet.</p>
    );
  if (!property)
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>Properties</h2>
          <button className="primary" onClick={() => onEdit("properties")}>
            + Add property
          </button>
        </div>
        <div className="entity-grid">
          {!store.properties.length && (
            <p className="empty">
              No properties yet. Add your first property folder.
            </p>
          )}
          {store.properties.map((p) => {
            const linked = store.tenancy_agreements.filter(
              (ta) => ta.property_id === p.id,
            );
            const tenants = new Set(
              linked.map((ta) => ta.tenant_id).filter(Boolean),
            ).size;
            return (
              <article className="entity property-folder" key={p.id}>
                <button
                  className="property-folder-open"
                  onClick={() => setSelected(p.id)}
                  aria-label={`Open property ${text(p.name)}`}
                >
                  {photo(p.name)}
                  <h3>{text(p.name)}</h3>
                  <p>
                    {store.units.filter((u) => u.property_id === p.id).length}{" "}
                    units · {tenants} tenants
                  </p>
                  <span className="property-folder-link">
                    View units & tenants →
                  </span>
                </button>
                <div className="row-actions">
                  <button onClick={() => onEdit("properties", p)}>Edit</button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => onRemove("properties", p)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  return (
    <section className="panel">
      <div className="property-folder-header">
        <button className="link back" onClick={() => setSelected(null)}>
          ← All properties
        </button>
        <div className="panel-heading">
          <div>
            <h2>{text(property.name)}</h2>
            <p className="muted">
              {units.length} units ·{" "}
              {
                new Set(agreements.map((ta) => ta.tenant_id).filter(Boolean))
                  .size
              }{" "}
              tenants
            </p>
          </div>
          <button
            className="primary"
            onClick={() => onEdit("units", { property_id: property.id })}
          >
            + Add unit
          </button>
        </div>
        <p className="muted">
          Units and tenants linked through this property's agreements.
        </p>
      </div>
      <div className="entity-grid property-unit-grid">
        {!units.length && (
          <p className="empty">
            No units in this property yet. Add a unit or create an agreement for
            this property.
          </p>
        )}
        {units.map((unit) => (
          <article className="entity" key={unit.id}>
            <h3>Unit {text(unit.unit_number)}</h3>
            {unit.floor && <p className="muted">Floor {text(unit.floor)}</p>}
            {tenantList(agreements.filter((ta) => ta.unit_id === unit.id))}
            <div className="row-actions">
              <button onClick={() => onEdit("units", unit)}>Edit unit</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => onRemove("units", unit)}
              >
                Delete unit
              </button>
            </div>
          </article>
        ))}
      </div>
      {agreements.some((ta) => !units.some((u) => u.id === ta.unit_id)) && (
        <div className="property-folder-header">
          <h3>Agreements without a linked unit</h3>
          {tenantList(
            agreements.filter((ta) => !units.some((u) => u.id === ta.unit_id)),
          )}
        </div>
      )}
    </section>
  );
}
