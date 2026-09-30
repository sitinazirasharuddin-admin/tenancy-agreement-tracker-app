import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("dialog", (d) => d.accept());
const tag = Date.now();
const company = `QA Tenant ${tag}`,
  property = `QA Property ${tag}`,
  reference = `QA-${tag}`;
const nav = (name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true });
const field = (name) => page.getByRole("dialog").locator(`[name="${name}"]`);
async function save(name) {
  await page.getByRole("button", { name: `Save ${name}`, exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  await page.goto("http://localhost:3000/demo");
  await page.getByRole("table").waitFor();
  await nav("Properties").click();
  await page
    .getByRole("button", { name: "+ Add property", exact: true })
    .click();
  await field("name").fill(property);
  await field("address").fill("Sample address");
  await save("property");
  await page.getByRole("button", { name: "+ Add unit", exact: true }).click();
  await field("property_id").selectOption({ label: property });
  await field("unit_number").fill("QA-01");
  await field("floor").fill("7");
  await save("unit");
  await nav("Tenants").click();
  await page.getByRole("button", { name: "+ Add tenant", exact: true }).click();
  await field("name").fill("Sample Contact");
  await field("company_name").fill(company);
  await field("contact_email").fill("sample@example.com");
  await save("tenant");
  await page.getByRole("button", { name: "+ New TA", exact: true }).click();
  await field("ta_reference").fill(reference);
  await field("tenant_id").selectOption({ label: company });
  await field("property_id").selectOption({ label: property });
  await field("unit_id").selectOption({ label: "QA-01" });
  await field("person_in_charge").fill("QA Staff");
  await field("commencement_date").fill("2027-01-01");
  await field("expiry_date").fill("2026-01-01");
  await page
    .getByRole("button", { name: "Save agreement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "Expiry date" })
    .waitFor();
  await field("expiry_date").fill("2027-12-31");
  await field("notes").fill("Test notes persisted");
  await save("agreement");
  for (const description of ["QA follow-up one", "QA follow-up two"]) {
    await page
      .getByRole("button", { name: "+ Add action", exact: true })
      .click();
    await field("description").fill(description);
    await save("action");
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Actions/ })
    .click();
  await page
    .getByLabel("Filter actions by agreement")
    .selectOption({ label: reference });
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.check();
  await page
    .getByRole("button", { name: "Complete selected (2)", exact: true })
    .click();
  await page
    .getByText("Selected actions completed.", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".action").count(), 0);
  await page.getByLabel("Action state").selectOption("completed");
  assert.equal(await page.locator(".action").count(), 2);
  await page.reload();
  await page
    .getByRole("table")
    .getByRole("button", { name: reference, exact: true })
    .click();
  assert.match(
    await page.locator(".notes").innerText(),
    /Test notes persisted/,
  );
  await page
    .locator(".panel-heading")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Confirm change" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Agreement deleted" })
    .waitFor();
  await nav("Properties").click();
  const unit = page
    .locator(".entity")
    .filter({ has: page.getByRole("heading", { name: "QA-01", exact: true }) });
  await unit.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Confirm change" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await unit.waitFor({ state: "hidden" });
  const prop = page.locator(".entity").filter({
    has: page.getByRole("heading", { name: property, exact: true }),
  });
  await prop.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Confirm change" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await prop.waitFor({ state: "hidden" });
  await nav("Tenants").click();
  const tenant = page.locator(".entity").filter({ hasText: company });
  await tenant.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Confirm change" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await tenant.waitFor({ state: "hidden" });
  await nav("Dashboard").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../qa/mobile.png", fullPage: true });
  console.log(
    "PASS: property, unit, tenant and linked agreement CRUD; invalid dates rejected; notes survive reload; bulk completion; dependent cleanup.",
  );
} finally {
  await browser.close();
}
