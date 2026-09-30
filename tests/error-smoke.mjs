import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto("http://localhost:3000");
  await page.getByRole("table").waitFor();
  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tenants", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Add tenant", exact: true }).click();
  await page.getByRole("dialog").locator("[name=name]").fill("Offline sample");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Save tenant", exact: true }).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("dialog").locator("[name=name]").inputValue(),
    "Offline sample",
  );
  await page.context().setOffline(false);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.screenshot({ path: "../qa/mobile.png", fullPage: true });
  console.log(
    "PASS: mobile menu, failed network save keeps form data, Escape closes dialog.",
  );
} finally {
  await browser.close();
}
