"use client";
import { useState } from "react";
import { label, type Row, type Store } from "@/lib/data/domain";

const text = (value: unknown) => String(value ?? "");

export default function SubmissionChecklist({
  store,
  busy,
  onOpen,
  onToggle,
}: {
  store: Store;
  busy: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const [agreement, setAgreement] = useState("");
  const [state, setState] = useState("all");
  const tenantName = (ta: Row) => {
    const tenant = store.tenants.find((t) => t.id === ta.tenant_id);
    return text(tenant?.company_name || tenant?.name || "Missing tenant");
  };
  const pending = store.tenancy_agreements.filter(
    (ta) => !ta.submission_completed,
  ).length;
  const rows = store.tenancy_agreements.filter(
    (ta) =>
      (!agreement || ta.id === agreement) &&
      (state === "all" ||
        !!ta.submission_completed === (state === "completed")),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Tenant submissions</h2>
        <span className="muted">
          {pending} pending · {store.tenancy_agreements.length} agreements
        </span>
      </div>
      <div className="filters">
        <select
          aria-label="Filter submissions by agreement"
          value={agreement}
          onChange={(e) => setAgreement(e.target.value)}
        >
          <option value="">All agreements</option>
          {store.tenancy_agreements.map((ta) => (
            <option key={ta.id} value={ta.id}>
              {text(ta.ta_reference)} · {tenantName(ta)}
            </option>
          ))}
        </select>
        <select
          aria-label="Submission state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="all">All submissions</option>
          <option value="open">Pending submissions</option>
          <option value="completed">Completed submissions</option>
        </select>
      </div>
      <div className="submission-list">
        {!rows.length && (
          <p className="empty">
            {store.tenancy_agreements.length
              ? "No submissions match this filter."
              : "No agreements yet. Add a New TA on your dashboard and it will appear here automatically."}
          </p>
        )}
        {rows.map((ta) => (
          <article
            className={`submission-card ${ta.submission_completed ? "is-complete" : ""}`}
            key={ta.id}
          >
            <div className="submission-heading">
              <div>
                <button className="link" onClick={() => onOpen(ta.id)}>
                  {text(ta.ta_reference)}
                </button>
                <h3>{tenantName(ta)}</h3>
                <p className="muted">
                  {text(
                    store.properties.find((p) => p.id === ta.property_id)?.name,
                  )}{" "}
                  · Unit{" "}
                  {text(
                    store.units.find((u) => u.id === ta.unit_id)?.unit_number,
                  )}
                </p>
                <p className="muted">
                  Person in charge: {text(ta.person_in_charge) || "—"} ·{" "}
                  {label(ta.status)}
                </p>
              </div>
              <label className="submission-tick">
                <input
                  type="checkbox"
                  checked={!!ta.submission_completed}
                  disabled={busy}
                  aria-label={`Submission completed for ${text(ta.ta_reference)}`}
                  onChange={(e) => onToggle(ta.id, e.target.checked)}
                />
                <span>Submission completed</span>
              </label>
            </div>
            <details className="submission-details">
              <summary>Agreement details</summary>
              <dl>
                {[
                  ["Signing date", ta.signing_date],
                  ["Commencement date", ta.commencement_date],
                  ["Expiry date", ta.expiry_date],
                  ["Stamping submission date", ta.stamping_submission_date],
                  ["Stamping due date", ta.stamping_due_date],
                  ["Stamping fee (RM)", ta.stamping_fee],
                  [
                    "Monthly rental — Year 1 (RM)",
                    ta.monthly_rental == null
                      ? null
                      : Number(ta.monthly_rental).toFixed(2),
                  ],
                  [
                    "Monthly rental — Year 2 (RM)",
                    ta.monthly_rental_year_2 == null
                      ? null
                      : Number(ta.monthly_rental_year_2).toFixed(2),
                  ],
                  [
                    "Monthly rental — Year 3 (RM)",
                    ta.monthly_rental_year_3 == null
                      ? null
                      : Number(ta.monthly_rental_year_3).toFixed(2),
                  ],
                  ["Total area (sq ft)", ta.total_square_feet],
                  ["Payment status", label(ta.payment_status)],
                  ["Notes", ta.notes],
                ].map(([title, value]) => (
                  <div key={text(title)}>
                    <dt>{text(title)}</dt>
                    <dd>{text(value) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
