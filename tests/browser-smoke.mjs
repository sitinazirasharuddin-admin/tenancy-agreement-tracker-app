import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.on("dialog", (dialog) => dialog.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("../qa", { recursive: true });
try {
  await page.goto("http://localhost:3000");
  await page
    .getByRole("table")
    .getByRole("button", { name: "TA-2024-015", exact: true })
    .waitFor({ timeout: 90000 });
  assert.match(
    await page.locator("tr").filter({ hasText: "TA-2024-015" }).innerText(),
    /Overdue stamping/,
  );
  await page.screenshot({ path: "../qa/dashboard.png", fullPage: true });
  await page.getByRole("button", { name: "+ New TA", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Agreement reference")
    .fill("TA-2024-018");
  await page
    .getByRole("dialog")
    .getByLabel("Tenant", { exact: false })
    .selectOption({ label: "Acme Solutions Sdn Bhd" });
  await page
    .getByRole("dialog")
    .getByLabel("Property", { exact: false })
    .selectOption({ label: "Menara Sentral" });
  await page
    .getByRole("dialog")
    .getByLabel("Unit", { exact: false })
    .selectOption({ label: "12-03" });
  await page
    .getByRole("dialog")
    .getByLabel("Person in charge")
    .fill("Nadia Hassan");
  await page
    .getByRole("button", { name: "Save agreement", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "TA-2024-018", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Send for Signing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark Signed", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Edit agreement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Signing date", { exact: true })
    .fill("2026-09-30");
  assert.match(await page.locator(".calculated").innerText(), /2026-10-30/);
  await page
    .getByRole("button", { name: "Save agreement", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Mark Signed", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for Stamping", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "+ Add action", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Description")
    .fill("Submit to LHDN");
  await page.getByRole("button", { name: "Save action", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(
    await page.locator(".action-list").innerText(),
    /Submit to LHDN/,
  );
  await page
    .getByRole("button", { name: "Edit agreement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Stamping submission date")
    .fill("2026-10-01");
  await page.getByRole("dialog").getByLabel("Stamping fee (RM)").fill("1250");
  await page
    .getByRole("dialog")
    .getByLabel("Payment status")
    .selectOption("paid");
  await page
    .getByRole("dialog")
    .locator("select[name=status]")
    .selectOption("completed");
  await page
    .getByRole("button", { name: "Save agreement", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".panel-heading h2 .count").innerText(), "0");
  await page.reload();
  await page
    .getByRole("button", { name: "TA-2024-018", exact: true })
    .waitFor();
  const row = page.locator("tr").filter({ hasText: "TA-2024-018" });
  assert.match(await row.innerText(), /Completed/);
  assert.equal(await row.locator(".count").innerText(), "0");
  await page
    .getByRole("textbox", { name: "Search agreements" })
    .fill("does-not-exist");
  await page
    .getByRole("heading", { name: "No tenancy agreements found" })
    .waitFor();
  await page.getByRole("textbox", { name: "Search agreements" }).fill("Acme");
  assert.ok((await page.locator("tbody tr").count()) >= 1);
  await page.getByRole("textbox", { name: "Search agreements" }).fill("");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  assert.equal((await download).suggestedFilename(), "tenancy-agreements.csv");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../qa/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser PRD create/sign/action/stamp/pay/complete/reload scenario, filtering, CSV, mobile layout; no browser errors.",
  );
} finally {
  await browser.close();
}
