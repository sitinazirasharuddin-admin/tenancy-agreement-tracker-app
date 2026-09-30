"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { loadStore, saveRow, deleteRow, saveManualAgreement } from "@/lib/data";
import {
  emptyStore,
  statuses,
  label,
  stampingDue,
  overdue,
  urgency,
  missingWorkflowDetails,
  type Row,
  type Store,
  type Table,
} from "@/lib/data/domain";
type Field = {
  key: string;
  title: string;
  type?: string;
  required?: boolean;
  options?: { value: string; title: string }[];
};
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, title: label(value) }));
const text = (v: unknown) => String(v ?? "");
function propertyPhoto(name: unknown) {
  const value = text(name).toLowerCase();
  if (value.includes("five")) return "/properties/the-five.png";
  if (value.includes("stories")) return "/properties/the-stories.png";
  if (value.includes("millen")) return "/properties/menara-millenium.png";
  return null;
}
function PropertyPhoto({
  name,
  className = "",
}: {
  name: unknown;
  className?: string;
}) {
  const src = propertyPhoto(name);
  return src ? (
    <Image
      className={`property-photo ${className}`}
      src={src}
      alt={text(name)}
      loading={className === "agreement-photo" ? "lazy" : "eager"}
      width={768}
      height={512}
      sizes={
        className === "agreement-photo"
          ? "44px"
          : "(max-width: 760px) 80vw, 400px"
      }
    />
  ) : (
    <div className={`property-placeholder ${className}`} aria-hidden="true">
      ▦
    </div>
  );
}
const names: Record<Table, string> = {
  tenancy_agreements: "Agreement",
  properties: "Property",
  units: "Unit",
  tenants: "Tenant",
  outstanding_actions: "Action",
};
const steps = [
  "Send for Signing",
  "Mark Signed",
  "Submit for Stamping",
  "Mark Stamping Complete",
  "Await Payment",
  "Complete Agreement",
];
type Props = {
  teamId?: string;
  teamName?: string;
  teamRole?: "admin" | "member";
  onTeamSettings?: () => void;
  onSwitchTeam?: () => void;
  onSignOut?: () => void;
};
export default function Tracker({
  teamId,
  teamName,
  teamRole,
  onTeamSettings,
  onSwitchTeam,
  onSignOut,
}: Props) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("Dashboard");
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    table: Table;
    row: Partial<Row>;
  } | null>(null);
  const [formError, setFormError] = useState("");
  const [workflowTarget, setWorkflowTarget] = useState<string | null>(null);
  const [property, setProperty] = useState("");
  const [signing, setSigning] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [filterProperty, setFilterProperty] = useState("");
  const [pic, setPic] = useState("");
  const [sort, setSort] = useState("created_at");
  const [actionFilter, setActionFilter] = useState("");
  const [actionState, setActionState] = useState("open");
  const [checked, setChecked] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  function confirmAction(message: string): Promise<boolean> {
    return new Promise((resolve) => setConfirmation({ message, resolve }));
  }
  function answerConfirmation(value: boolean) {
    confirmation?.resolve(value);
    setConfirmation(null);
  }
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!editor || confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setEditor(null);
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        ) ?? [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [editor, busy, confirmation]);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setStore(await loadStore(teamId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const find = (table: Table, id: unknown) =>
    store[table].find((row) => row.id === id);
  const tenantName = (ta: Row) => {
    const t = find("tenants", ta.tenant_id);
    return text(t?.company_name || t?.name || "Missing tenant");
  };
  const openActions = (id: unknown) =>
    store.outstanding_actions.filter((a) => a.ta_id === id && !a.completed);
  const current = store.tenancy_agreements.find((t) => t.id === selected);
  function edit(table: Table, row: Partial<Row> = {}) {
    setWorkflowTarget(null);
    setFormError("");
    setProperty(text(row.property_id));
    setSigning(text(row.signing_date));
    setEditor({ table, row });
  }
  async function mutate(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setStore(await loadStore(teamId));
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function remove(table: Table, row: Row) {
    if (teamId && teamRole !== "admin") {
      setError("Only team admins can delete records.");
      return;
    }
    if (
      !(await confirmAction(
        `Delete this ${names[table].toLowerCase()} permanently?${table === "tenancy_agreements" ? " Its linked actions will also be deleted." : ""}`,
      ))
    )
      return;
    if (
      await mutate(
        () => deleteRow(table, row.id, store, teamId),
        `${names[table]} deleted.`,
      )
    ) {
      if (selected === row.id) setSelected(null);
    }
  }
  async function transition(ta: Row, next: string) {
    if (missingWorkflowDetails(ta, next).length) {
      edit("tenancy_agreements", { ...ta, status: next });
      setWorkflowTarget(next);
      return;
    }
    if (
      next === "completed" &&
      !(await confirmAction(
        "Complete this agreement and mark all its outstanding actions completed?",
      ))
    )
      return;
    await mutate(
      () =>
        saveRow("tenancy_agreements", { ...ta, status: next }, store, teamId),
      `Agreement ${label(next).toLowerCase()}.`,
    );
  }
  const references = (table: Table, display: (r: Row) => string) =>
    store[table].map((r) => ({ value: r.id, title: display(r) }));
  function fields(table: Table): Field[] {
    if (table === "tenancy_agreements")
      return [
        { key: "ta_reference", title: "Agreement reference", required: true },
        {
          key: editor?.row.id ? "tenant_id" : "tenant_name",
          title: "Tenant",
          required: true,
          options: editor?.row.id
            ? references("tenants", (r) => text(r.company_name || r.name))
            : undefined,
        },
        {
          key: "property_id",
          title: "Property",
          required: true,
          options: references("properties", (r) => text(r.name)),
        },
        {
          key: editor?.row.id ? "unit_id" : "unit_number",
          title: "Unit",
          required: true,
          options: editor?.row.id
            ? store.units
                .filter((u) => u.property_id === property)
                .map((u) => ({ value: u.id, title: text(u.unit_number) }))
            : undefined,
        },
        { key: "person_in_charge", title: "Person in charge", required: true },
        {
          key: "status",
          title: "Status",
          options: options(statuses),
          required: true,
        },
        { key: "signing_date", title: "Signing date", type: "date" },
        { key: "commencement_date", title: "Commencement date", type: "date" },
        { key: "expiry_date", title: "Expiry date", type: "date" },
        {
          key: "stamping_submission_date",
          title: "Stamping submission date",
          type: "date",
        },
        { key: "stamping_fee", title: "Stamping fee (RM)", type: "number" },
        {
          key: "payment_status",
          title: "Payment status",
          options: options(["pending", "partial", "paid", "na"]),
          required: true,
        },
        { key: "notes", title: "Notes", type: "textarea" },
      ];
    if (table === "properties")
      return [
        { key: "name", title: "Property name", required: true },
        { key: "address", title: "Address", type: "textarea" },
      ];
    if (table === "units")
      return [
        {
          key: "property_id",
          title: "Property",
          required: true,
          options: references("properties", (r) => text(r.name)),
        },
        { key: "unit_number", title: "Unit number", required: true },
        { key: "floor", title: "Floor" },
      ];
    if (table === "tenants")
      return [
        { key: "name", title: "Contact name", required: true },
        { key: "company_name", title: "Company name" },
        { key: "contact_email", title: "Email", type: "email" },
        { key: "contact_phone", title: "Phone", type: "tel" },
      ];
    return [
      {
        key: "ta_id",
        title: "Agreement",
        required: true,
        options: references("tenancy_agreements", (r) => text(r.ta_reference)),
      },
      {
        key: "action_type",
        title: "Action type",
        required: true,
        options: options([
          "signing",
          "stamping",
          "payment",
          "filing",
          "drafting",
        ]),
      },
      {
        key: "description",
        title: "Description",
        required: true,
        type: "textarea",
      },
      { key: "due_date", title: "Due date", type: "date" },
      {
        key: "priority",
        title: "Priority",
        required: true,
        options: options(["medium", "high", "low"]),
      },
    ];
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setFormError("");
    const data = new FormData(event.currentTarget);
    const row: Partial<Row> = { ...editor.row };
    for (const f of fields(editor.table)) {
      const value = text(data.get(f.key)).trim();
      row[f.key] =
        value === "" ? null : f.type === "number" ? Number(value) : value;
    }
    if (workflowTarget) {
      const missing = missingWorkflowDetails(row, text(row.status));
      if (missing.length) {
        setFormError(
          `Complete these details before saving: ${missing.map(label).join(", ")}.`,
        );
        return;
      }
    }
    if (
      editor.table === "tenancy_agreements" &&
      row.status === "completed" &&
      find("tenancy_agreements", editor.row.id)?.status !== "completed" &&
      !(await confirmAction(
        "Complete this agreement and all linked outstanding actions?",
      ))
    )
      return;
    if (
      editor.table === "outstanding_actions" &&
      find("tenancy_agreements", row.ta_id)?.status === "completed" &&
      !row.completed
    ) {
      setFormError("Reopen the agreement before adding an outstanding action.");
      return;
    }
    setBusy(true);
    try {
      const saved =
        editor.table === "tenancy_agreements" && !editor.row.id
          ? await saveManualAgreement(row, teamId)
          : await saveRow(editor.table, row, store, teamId);
      setStore(await loadStore(teamId));
      setNotice(`${names[editor.table]} saved.`);
      if (editor.table === "tenancy_agreements") setSelected(saved.id);
      setEditor(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = store.tenancy_agreements
    .filter(
      (t) =>
        (!status || t.status === status) &&
        (!filterProperty || t.property_id === filterProperty) &&
        (!pic || t.person_in_charge === pic) &&
        `${t.ta_reference} ${tenantName(t)} ${find("tenants", t.tenant_id)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "created_at"
        ? text(b.created_at).localeCompare(text(a.created_at))
        : text(a[sort] || "9999").localeCompare(text(b[sort] || "9999")),
    );
  const filteredActions = store.outstanding_actions
    .filter(
      (a) =>
        (!actionFilter || a.ta_id === actionFilter) &&
        (actionState === "all" ||
          !!a.completed === (actionState === "completed")),
    )
    .sort(
      (a, b) =>
        urgency(b, find("tenancy_agreements", b.ta_id)) -
        urgency(a, find("tenancy_agreements", a.ta_id)),
    );
  function exportCSV() {
    const columns = [
      "ta_reference",
      "tenant",
      "property",
      "unit",
      "status",
      "person_in_charge",
      "signing_date",
      "stamping_due_date",
      "commencement_date",
      "expiry_date",
      "stamping_submission_date",
      "stamping_fee",
      "payment_status",
      "notes",
    ];
    const escape = (v: unknown) => {
      let value = text(v);
      if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replaceAll('"', '""')}"`;
    };
    const content = [
      columns,
      ...filtered.map((r) =>
        columns.map((c) =>
          c === "tenant"
            ? tenantName(r)
            : c === "property"
              ? find("properties", r.property_id)?.name
              : c === "unit"
                ? find("units", r.unit_id)?.unit_number
                : r[c],
        ),
      ),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenancy-agreements.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function actionList(rows: Row[], bulk = false) {
    return (
      <div className="action-list">
        {!rows.length && <p className="empty">No outstanding actions</p>}
        {rows.map((a) => {
          const ta = find("tenancy_agreements", a.ta_id);
          const score = urgency(a, ta);
          return (
            <div className="action" key={a.id}>
              {bulk && !a.completed && (
                <input
                  type="checkbox"
                  aria-label={`Select ${a.description}`}
                  checked={checked.includes(a.id)}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? [...checked, a.id]
                        : checked.filter((id) => id !== a.id),
                    )
                  }
                />
              )}
              <span
                className={`dot ${a.completed ? "done" : score >= 50 ? "red" : score >= 25 ? "amber" : ""}`}
              />
              <div className="grow">
                <strong>{text(a.description)}</strong>
                <small>
                  <button
                    className="link"
                    onClick={() => setSelected(text(a.ta_id))}
                  >
                    {text(ta?.ta_reference)}
                  </button>{" "}
                  · {text(a.due_date || "No due date")} · {label(a.priority)}{" "}
                  priority · {a.completed ? "Completed" : `Urgency ${score}`}
                </small>
              </div>
              <div className="row-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      () =>
                        saveRow(
                          "outstanding_actions",
                          { ...a, completed: !a.completed },
                          store,
                          teamId,
                        ),
                      a.completed ? "Action reopened." : "Action completed.",
                    )
                  }
                >
                  {a.completed ? "Reopen" : "Complete"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => edit("outstanding_actions", a)}
                >
                  Edit
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => void remove("outstanding_actions", a)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  function agreementTable() {
    return (
      <>
        <div className="filters">
          <input
            aria-label="Search agreements"
            placeholder="Search reference or tenant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by property"
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
          >
            <option value="">All properties</option>
            {store.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {text(p.name)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by person in charge"
            value={pic}
            onChange={(e) => setPic(e.target.value)}
          >
            <option value="">All staff</option>
            {Array.from(
              new Set(
                store.tenancy_agreements
                  .map((t) => text(t.person_in_charge))
                  .filter(Boolean),
              ),
            ).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            aria-label="Sort agreements"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="created_at">Newest first</option>
            <option value="stamping_due_date">Stamping due date</option>
            <option value="signing_date">Signing date</option>
          </select>
        </div>
        <div className="agreement-cards">
          {filtered.map((ta) => (
            <button
              className="agreement-card"
              key={ta.id}
              onClick={() => setSelected(ta.id)}
            >
              <PropertyPhoto
                name={find("properties", ta.property_id)?.name}
                className="agreement-photo"
              />
              <div className="card-top">
                <strong>{text(ta.ta_reference)}</strong>
                <span className={`badge ${ta.status}`}>{label(ta.status)}</span>
              </div>
              <h3>{tenantName(ta)}</h3>
              <p>
                {text(find("properties", ta.property_id)?.name)} · Unit{" "}
                {text(find("units", ta.unit_id)?.unit_number)}
              </p>
              <div className="card-bottom">
                <span className={overdue(ta) ? "overdue" : ""}>
                  {overdue(ta) ? "Overdue · " : ""}
                  {text(ta.stamping_due_date || "Signing date not set")}
                </span>
                <span>{openActions(ta.id).length} open actions →</span>
              </div>
            </button>
          ))}
          {!filtered.length && (
            <div className="empty">
              <h3>No tenancy agreements found</h3>
              <button
                className="primary"
                onClick={() => edit("tenancy_agreements")}
              >
                Create New TA
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agreement / tenant</th>
                <th>Property / unit</th>
                <th>Status</th>
                <th>Stamping due</th>
                <th>In charge</th>
                <th>Open actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ta) => (
                <tr key={ta.id}>
                  <td>
                    <button
                      className="reference"
                      onClick={() => setSelected(ta.id)}
                    >
                      {text(ta.ta_reference)}
                    </button>
                    <small>{tenantName(ta)}</small>
                  </td>
                  <td>
                    {text(find("properties", ta.property_id)?.name)}
                    <small>
                      Unit {text(find("units", ta.unit_id)?.unit_number)}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${ta.status}`}>
                      {label(ta.status)}
                    </span>
                  </td>
                  <td className={overdue(ta) ? "overdue" : ""}>
                    {text(ta.stamping_due_date || "Not set")}
                    <small>
                      {overdue(ta)
                        ? "● Overdue stamping"
                        : !ta.signing_date
                          ? "Awaiting signing date"
                          : ""}
                    </small>
                  </td>
                  <td>{text(ta.person_in_charge)}</td>
                  <td>
                    <span className="count">{openActions(ta.id).length}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <h3>No tenancy agreements found</h3>
              <p>Create an agreement or adjust your filters.</p>
              <button
                className="primary"
                onClick={() => edit("tenancy_agreements")}
              >
                Create New TA
              </button>
            </div>
          )}
        </div>
      </>
    );
  }
  return (
    <div
      className={`shell ${teamId ? "private-workspace" : "demo-workspace"} ${teamRole === "member" ? "member-workspace" : ""}`}
    >
      <aside inert={!!editor}>
        <a className="brand" href="/">
          ▦{" "}
          <span>
            Tenancy<span className="brand-sub">LEASING WORKSPACE</span>
          </span>
        </a>
        <div className="nav-title">WORKSPACE</div>
        <button
          className="mobile-menu"
          aria-expanded={menuOpen}
          aria-controls="workspace-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰ Menu
        </button>
        <nav id="workspace-nav" className={menuOpen ? "menu-open" : ""}>
          {["Dashboard", "Agreements", "Properties", "Tenants", "Actions"].map(
            (s, i) => (
              <button
                key={s}
                aria-label={s}
                className={section === s && !current ? "active" : ""}
                onClick={() => {
                  setSection(s);
                  setMenuOpen(false);
                  setSelected(null);
                  setNotice("");
                }}
              >
                <span>{["◫", "▤", "▦", "◎", "☑"][i]}</span>
                {s}
                {s === "Actions" && (
                  <b>
                    {
                      store.outstanding_actions.filter((a) => !a.completed)
                        .length
                    }
                  </b>
                )}
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <span className="demo-dot" /> {teamName || "Demo workspace"}
          <small>
            {teamId
              ? `${teamRole === "admin" ? "Admin" : "Member"} · Private access`
              : "Shared sample data · No login required"}
          </small>
          {teamId ? (
            <div className="workspace-controls">
              <button onClick={onTeamSettings}>Team settings</button>
              <button onClick={onSwitchTeam}>Switch team</button>
              <button onClick={onSignOut}>Sign out</button>
            </div>
          ) : (
            <a className="private-link" href="/">
              Open private workspace →
            </a>
          )}
        </div>
      </aside>
      <main inert={!!editor}>
        <div className="topbar">
          <span>
            Workspace{" "}
            <span className="muted">
              / {current ? current.ta_reference : section}
            </span>
          </span>
          <span className="demo-tag">
            {teamId ? "PRIVATE TEAM" : "PUBLIC DEMO"}
          </span>
        </div>
        <div className="content">
          <div className="demo-banner">
            {teamId
              ? "Private team workspace · Only your team members can access these records."
              : "Demo workspace — use sample information only. Changes are shared with everyone."}
          </div>
          <header>
            <div>
              <p className="eyebrow">LEASING OPERATIONS</p>
              <h1>
                {current
                  ? text(current.ta_reference)
                  : section === "Dashboard"
                    ? "Your agreements, at a glance."
                    : section}
              </h1>
              <p className="muted">
                {current
                  ? `${tenantName(current)} · ${text(find("properties", current.property_id)?.name)}`
                  : "Keep every signature, deadline and follow-up on track."}
              </p>
            </div>
            <div className="row-actions">
              {!current && ["Dashboard", "Agreements"].includes(section) && (
                <button onClick={exportCSV} disabled={loading || !!error}>
                  Export CSV ↗
                </button>
              )}
              <button
                className="primary"
                disabled={loading || busy}
                onClick={() => edit("tenancy_agreements")}
              >
                + New TA
              </button>
            </div>
          </header>
          {error && (
            <div className="alert error" role="alert">
              {error}{" "}
              <button onClick={() => void refresh()} disabled={busy}>
                Retry loading
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {loading ? (
            <div aria-label="Loading agreements" className="skeletons">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} />
              ))}
            </div>
          ) : error && !store.tenancy_agreements.length ? (
            <section className="panel empty">
              <h2>Unable to load workspace</h2>
              <p>
                Your records will appear once the database connection is
                available.
              </p>
            </section>
          ) : current ? (
            <>
              <button className="link back" onClick={() => setSelected(null)}>
                ← Back to {section.toLowerCase()}
              </button>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Agreement details</h2>
                  <div className="row-actions">
                    <button onClick={() => edit("tenancy_agreements", current)}>
                      Edit agreement
                    </button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => void remove("tenancy_agreements", current)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="workflow">
                  {statuses.map((s, i) => (
                    <span
                      key={s}
                      className={
                        statuses.indexOf(
                          current.status as (typeof statuses)[number],
                        ) >= i
                          ? "reached"
                          : ""
                      }
                    >
                      <b>{i + 1}</b>
                      {label(s)}
                    </span>
                  ))}
                </div>
                <div className="detail-grid">
                  {[
                    "person_in_charge",
                    "signing_date",
                    "stamping_due_date",
                    "commencement_date",
                    "expiry_date",
                    "stamping_submission_date",
                    "stamping_fee",
                    "payment_status",
                  ].map((k) => (
                    <div key={k}>
                      <small>{label(k)}</small>
                      <strong
                        className={
                          k === "stamping_due_date" && overdue(current)
                            ? "overdue"
                            : ""
                        }
                      >
                        {current[k] == null
                          ? "Not set"
                          : k === "stamping_fee"
                            ? `RM ${Number(current[k]).toFixed(2)}`
                            : label(current[k])}
                      </strong>
                    </div>
                  ))}
                </div>
                {!current.signing_date && (
                  <p className="partial">
                    Set signing date to calculate stamping due date.
                  </p>
                )}
                {current.status === "stamping_submitted" &&
                  current.stamping_fee === null && (
                    <p className="partial">
                      Stamping fee is incomplete — edit the agreement to enter
                      the fee.
                    </p>
                  )}
                <p className="notes">
                  {text(current.notes || "No notes yet.")}
                </p>
                {current.status !== "completed" && (
                  <div className="next-step">
                    <p>
                      <strong>Suggested next step</strong>
                      <small>
                        {steps[
                          statuses.indexOf(
                            current.status as (typeof statuses)[number],
                          )
                        ] || "Review agreement"}
                      </small>
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void transition(
                          current,
                          statuses[
                            statuses.indexOf(
                              current.status as (typeof statuses)[number],
                            ) + 1
                          ],
                        )
                      }
                    >
                      {
                        steps[
                          statuses.indexOf(
                            current.status as (typeof statuses)[number],
                          )
                        ]
                      }
                    </button>
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    Outstanding actions{" "}
                    <span className="count">
                      {openActions(current.id).length}
                    </span>
                  </h2>
                  <button
                    disabled={current.status === "completed"}
                    onClick={() =>
                      edit("outstanding_actions", {
                        ta_id: current.id,
                        due_date: current.stamping_due_date,
                        action_type:
                          current.status === "signed" ? "stamping" : "signing",
                      })
                    }
                  >
                    + Add action
                  </button>
                </div>
                {actionList(
                  store.outstanding_actions.filter(
                    (a) => a.ta_id === current.id,
                  ),
                )}
              </section>
            </>
          ) : (
            <>
              {section === "Dashboard" && (
                <>
                  <div className="stats">
                    {[
                      [
                        "Active agreements",
                        store.tenancy_agreements.filter(
                          (t) => t.status !== "completed",
                        ).length,
                        "Across your portfolio",
                      ],
                      [
                        "Overdue stamping",
                        store.tenancy_agreements.filter((t) => overdue(t))
                          .length,
                        "Needs your attention",
                      ],
                      [
                        "Open actions",
                        store.outstanding_actions.filter((a) => !a.completed)
                          .length,
                        "Follow-ups to complete",
                      ],
                      [
                        "Completed",
                        store.tenancy_agreements.filter(
                          (t) => t.status === "completed",
                        ).length,
                        "Signed, stamped & settled",
                      ],
                    ].map(([title, value, caption], i) => (
                      <div className={`stat stat-${i}`} key={title}>
                        <span>{title}</span>
                        <strong>{value}</strong>
                        <small>{caption}</small>
                      </div>
                    ))}
                  </div>
                  <div className="status-summary">
                    {statuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setStatus(s);
                          setSection("Agreements");
                        }}
                      >
                        {label(s)}{" "}
                        <b>
                          {
                            store.tenancy_agreements.filter(
                              (t) => t.status === s,
                            ).length
                          }
                        </b>
                      </button>
                    ))}
                  </div>
                  {!!store.properties.length && (
                    <section
                      className="featured-properties"
                      aria-label="Featured properties"
                    >
                      <div className="featured-heading">
                        <h2>
                          Featured properties{" "}
                          <span className="count">
                            {store.properties.length}
                          </span>
                        </h2>
                        <button
                          className="link"
                          onClick={() => setSection("Properties")}
                        >
                          Browse all →
                        </button>
                      </div>
                      <div className="property-strip">
                        {store.properties.map((p) => (
                          <button
                            className="property-card"
                            key={p.id}
                            onClick={() => {
                              setFilterProperty(p.id);
                              setStatus("");
                              setQuery("");
                              setPic("");
                              setSection("Agreements");
                            }}
                            aria-label={`View agreements for ${text(p.name)}`}
                          >
                            <PropertyPhoto name={p.name} />
                            <div>
                              <h3>{text(p.name)}</h3>
                              <small>
                                {
                                  store.units.filter(
                                    (u) => u.property_id === p.id,
                                  ).length
                                }{" "}
                                units ·{" "}
                                {
                                  store.tenancy_agreements.filter(
                                    (t) => t.property_id === p.id,
                                  ).length
                                }{" "}
                                agreements
                              </small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              {["Dashboard", "Agreements"].includes(section) && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      Tenancy agreements{" "}
                      <span className="count">{filtered.length}</span>
                    </h2>
                    <span className="muted">Live workspace records</span>
                  </div>
                  {agreementTable()}
                </section>
              )}
              {section === "Dashboard" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Needs attention</h2>
                    <button
                      className="link"
                      onClick={() => setSection("Actions")}
                    >
                      View all actions →
                    </button>
                  </div>
                  {actionList(
                    store.outstanding_actions
                      .filter((a) => !a.completed)
                      .sort(
                        (a, b) =>
                          urgency(b, find("tenancy_agreements", b.ta_id)) -
                          urgency(a, find("tenancy_agreements", a.ta_id)),
                      )
                      .slice(0, 5),
                  )}
                </section>
              )}
              {section === "Actions" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Follow-ups</h2>
                    <button
                      className="primary"
                      onClick={() => edit("outstanding_actions")}
                    >
                      + Add action
                    </button>
                  </div>
                  <div className="filters">
                    <select
                      aria-label="Filter actions by agreement"
                      value={actionFilter}
                      onChange={(e) => {
                        setActionFilter(e.target.value);
                        setChecked([]);
                      }}
                    >
                      <option value="">All agreements</option>
                      {store.tenancy_agreements.map((t) => (
                        <option key={t.id} value={t.id}>
                          {text(t.ta_reference)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Action state"
                      value={actionState}
                      onChange={(e) => {
                        setActionState(e.target.value);
                        setChecked([]);
                      }}
                    >
                      <option value="open">Open actions</option>
                      <option value="completed">Completed actions</option>
                      <option value="all">All actions</option>
                    </select>
                    <button
                      disabled={busy || !checked.length}
                      onClick={() =>
                        void mutate(async () => {
                          for (const id of checked) {
                            const row = find("outstanding_actions", id);
                            if (row)
                              await saveRow(
                                "outstanding_actions",
                                { ...row, completed: true },
                                store,
                                teamId,
                              );
                          }
                          setChecked([]);
                        }, "Selected actions completed.")
                      }
                    >
                      Complete selected ({checked.length})
                    </button>
                  </div>
                  {actionList(filteredActions, true)}
                </section>
              )}
              {["Properties", "Tenants"].includes(section) &&
                (section === "Properties"
                  ? (["properties", "units"] as Table[])
                  : (["tenants"] as Table[])
                ).map((table) => (
                  <section className="panel" key={table}>
                    <div className="panel-heading">
                      <h2>{label(table)}</h2>
                      <button className="primary" onClick={() => edit(table)}>
                        + Add {names[table].toLowerCase()}
                      </button>
                    </div>
                    <div className="entity-grid">
                      {!store[table].length && (
                        <p className="empty">
                          No {table} yet. Add your first record.
                        </p>
                      )}
                      {store[table].map((r) => (
                        <article className="entity" key={r.id}>
                          {table === "properties" && (
                            <PropertyPhoto
                              name={r.name}
                              className="entity-photo"
                            />
                          )}
                          <div className="entity-icon">
                            {table === "tenants" ? "◎" : "▦"}
                          </div>
                          <h3>{text(r.name || r.unit_number)}</h3>
                          <p>
                            {text(
                              r.company_name ||
                                r.address ||
                                find("properties", r.property_id)?.name,
                            )}
                          </p>
                          <small>
                            {text(
                              r.contact_email ||
                                (r.floor ? `Floor ${r.floor}` : ""),
                            )}
                          </small>
                          <small>{text(r.contact_phone)}</small>
                          <div className="row-actions">
                            <button onClick={() => edit(table, r)}>Edit</button>
                            <button
                              className="danger"
                              disabled={busy}
                              onClick={() => void remove(table, r)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </>
          )}
        </div>
      </main>
      <nav
        className="mobile-bottom-nav"
        aria-label="Quick navigation"
        inert={!!editor}
      >
        {[
          ["Dashboard", "◫", "Home"],
          ["Agreements", "▤", "Agreements"],
          ["Actions", "☑", "Actions"],
          ["Properties", "▦", "Properties"],
        ].map(([target, icon, title]) => (
          <button
            key={target}
            aria-label={`Go to ${target.toLowerCase()}`}
            aria-current={section === target && !current ? "page" : undefined}
            className={section === target && !current ? "active" : ""}
            onClick={() => {
              setSection(target);
              setSelected(null);
              setMenuOpen(false);
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {title}
          </button>
        ))}
        {teamId && (
          <button onClick={onTeamSettings}>
            <span aria-hidden="true">⚙</span>Settings
          </button>
        )}
      </nav>
      {editor && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditor(null);
          }}
        >
          <section
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <div className="panel-heading">
              <h2 id="editor-title">
                {editor.row.id ? "Edit" : "New"} {names[editor.table]}
              </h2>
              <button
                aria-label="Close form"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={submit}>
              {workflowTarget && (
                <div className="alert workflow-guidance" role="status">
                  To move this agreement to{" "}
                  {label(workflowTarget).toLowerCase()}, complete:{" "}
                  {missingWorkflowDetails(editor.row, workflowTarget)
                    .map(label)
                    .join(", ")}
                  . Review the details, then save.
                </div>
              )}
              <div className="form-grid">
                {fields(editor.table).map((f, i) => (
                  <label
                    key={f.key}
                    className={f.type === "textarea" ? "wide" : ""}
                  >
                    {f.title}
                    {f.required && " *"}
                    {f.options ? (
                      <select
                        name={f.key}
                        required={
                          f.required ||
                          !!(
                            workflowTarget &&
                            missingWorkflowDetails(
                              editor.row,
                              workflowTarget,
                            ).includes(f.key)
                          )
                        }
                        defaultValue={text(
                          editor.row[f.key] ||
                            ([
                              "status",
                              "payment_status",
                              "priority",
                              "action_type",
                            ].includes(f.key)
                              ? f.options[0]?.value
                              : ""),
                        )}
                        key={f.key === "unit_id" ? property : f.key}
                        onChange={
                          f.key === "property_id"
                            ? (e) => setProperty(e.target.value)
                            : undefined
                        }
                      >
                        <option value="">Select {f.title.toLowerCase()}</option>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.title}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        name={f.key}
                        required={f.required}
                        defaultValue={text(editor.row[f.key])}
                        rows={3}
                      />
                    ) : (
                      <input
                        autoFocus={
                          workflowTarget
                            ? f.key ===
                              missingWorkflowDetails(
                                editor.row,
                                workflowTarget,
                              )[0]
                            : i === 0
                        }
                        name={f.key}
                        type={f.type || "text"}
                        required={
                          f.required ||
                          !!(
                            workflowTarget &&
                            missingWorkflowDetails(
                              editor.row,
                              workflowTarget,
                            ).includes(f.key)
                          )
                        }
                        defaultValue={text(editor.row[f.key])}
                        step={f.type === "number" ? "0.01" : undefined}
                        min={f.type === "number" ? "0" : undefined}
                        onChange={
                          f.key === "signing_date"
                            ? (e) => setSigning(e.target.value)
                            : undefined
                        }
                      />
                    )}
                  </label>
                ))}
                {editor.table === "tenancy_agreements" && (
                  <p className="calculated wide">
                    Stamping due date:{" "}
                    <strong>
                      {stampingDue(signing) || "Set signing date"}
                    </strong>{" "}
                    <small>
                      Automatically calculated: signing date + 30 days.
                    </small>
                  </p>
                )}
              </div>
              {formError && (
                <div role="alert" className="alert error">
                  {formError}
                </div>
              )}
              <footer>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy} type="submit">
                  {busy
                    ? "Saving…"
                    : `Save ${names[editor.table].toLowerCase()}`}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {confirmation && (
        <Confirmation
          message={confirmation.message}
          onAnswer={answerConfirmation}
        />
      )}
    </div>
  );
}

function Confirmation({
  message,
  onAnswer,
}: {
  message: string;
  onAnswer: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirmation-dialog"
      aria-labelledby="confirmation-title"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
    >
      <h2 id="confirmation-title">Confirm change</h2>
      <p>{message}</p>
      <footer>
        <button autoFocus onClick={() => onAnswer(false)}>
          Cancel
        </button>
        <button className="primary" onClick={() => onAnswer(true)}>
          Confirm
        </button>
      </footer>
    </dialog>
  );
}
