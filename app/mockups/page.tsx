import Link from "next/link";
const sample = [
  {
    reference: "TA-2026-028",
    tenant: "Sample Office Tenant",
    property: "Menara Millenium · Unit 12-03",
    status: "Signed",
    due: "30 Oct 2026",
    actions: 2,
  },
  {
    reference: "TA-2026-027",
    tenant: "Sample Retail Tenant",
    property: "The five · Unit G-08",
    status: "Pending signing",
    due: "Awaiting signature",
    actions: 1,
  },
  {
    reference: "TA-2026-026",
    tenant: "Sample Studio Tenant",
    property: "The Stories of Taman Tunku · Unit 2-01",
    status: "Completed",
    due: "28 Sep 2026",
    actions: 0,
  },
];
function Cards() {
  return (
    <div className="preview-cards">
      {sample.map((a) => (
        <article key={a.reference}>
          <div>
            <b>{a.reference}</b>
            <span>{a.status}</span>
          </div>
          <h3>{a.tenant}</h3>
          <p>{a.property}</p>
          <footer>
            <span>{a.due}</span>
            <strong>{a.actions} open actions →</strong>
          </footer>
        </article>
      ))}
    </div>
  );
}
export default function Mockups() {
  return (
    <div className="mockup-page">
      <div className="mockup-heading">
        <p className="eyebrow">DESIGN PREVIEW · SAMPLE DATA</p>
        <h1>Your team workspace, everywhere.</h1>
        <p>
          Private teams, a clear portfolio overview, and agreements designed for
          the screen in your hand.
        </p>
        <Link href="/">Open the working app →</Link>
      </div>
      <div className="mockup-gallery">
        <section>
          <h2>Desktop workspace</h2>
          <div className="desktop-preview">
            <div className="preview-nav">
              <b>▦ Tenancy</b>
              <small>LEASING TEAM</small>
              <p className="chosen">◫ Dashboard</p>
              <p>▤ Agreements</p>
              <p>▦ Properties</p>
              <p>◎ Tenants</p>
              <p>☑ Actions</p>
              <footer>
                ● Private workspace
                <br />
                <small>Admin · 3 members</small>
              </footer>
            </div>
            <div className="preview-main">
              <div className="preview-top">
                Workspace / Dashboard <span>PRIVATE TEAM</span>
              </div>
              <p className="eyebrow">LEASING OPERATIONS</p>
              <h3>Good work starts with a clear view.</h3>
              <p className="muted">
                Every agreement. Every deadline. One team.
              </p>
              <div className="preview-stats">
                <div>
                  Active agreements<strong>12</strong>
                </div>
                <div>
                  Needs attention<strong>3</strong>
                </div>
                <div>
                  Completed<strong>28</strong>
                </div>
              </div>
              <div className="preview-panel">
                <h4>
                  Tenancy agreements <small>Across your portfolio</small>
                </h4>
                <Cards />
              </div>
            </div>
          </div>
        </section>
        <section>
          <h2>Mobile workspace</h2>
          <div className="phone-preview">
            <div className="phone-status">
              9:41 <span>● ▰</span>
            </div>
            <div className="phone-nav">
              <b>▦ Tenancy</b>
              <span>☰</span>
            </div>
            <div className="phone-body">
              <small>LEASING TEAM · PRIVATE</small>
              <h3>
                Your day,
                <br />
                under control.
              </h3>
              <p className="muted">Keep the next step in sight.</p>
              <div className="phone-summary">
                <div>
                  Active<strong>12</strong>
                </div>
                <div>
                  Attention<strong>3</strong>
                </div>
              </div>
              <div className="preview-search">⌕ Search agreements</div>
              <Cards />
            </div>
            <div className="phone-bottom">
              <span>
                ◫<small>Home</small>
              </span>
              <span>
                ▤<small>Agreements</small>
              </span>
              <span>
                ☑<small>Actions</small>
              </span>
              <span>
                ◎<small>Team</small>
              </span>
            </div>
          </div>
        </section>
      </div>
      <div className="mockup-notes">
        <h2>Designed for daily work</h2>
        <p>
          <b>Private by team.</b> Team switching and admin/member roles keep
          each portfolio separate.
        </p>
        <p>
          <b>Readable on mobile.</b> Agreement cards expose status, deadlines
          and next actions without horizontal scrolling.
        </p>
        <p>
          <b>Ready for your portfolio.</b> Menara Millenium, The five, and The
          Stories of Taman Tunku are available as starting properties. No real
          tenant records are included in this preview.
        </p>
      </div>
    </div>
  );
}
