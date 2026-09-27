// E2E flows (Playwright, real browser). Base URL = app server (API + static).
// Run: npx playwright test -c tests/e2e/playwright.config.js
// Canvas globe: prefer role/DOM locators + entity inspection over canvas clicks.
const { test, expect } = require("@playwright/test");

function benignConsole(text) {
  // Cesium mounts a sandboxed about:blank InfoBox iframe; Chromium logs its
  // blocked script execution as a console error. Benign app behavior.
  return /about:blank.*sandboxed|allow-scripts/.test(text);
}
function modeBtn(page, name) {
  return page.getByRole("group", { name: "Tracking mode" }).getByRole("button", { name, exact: true });
}

test.beforeEach(async ({ page }) => {
  page._jsErrors = [];
  page.on("pageerror", (e) => page._jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !benignConsole(m.text())) page._jsErrors.push("console: " + m.text()); });
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  expect(page._jsErrors).toEqual([]);
});

test("E-APP-01 launch renders globe + count", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("#count")).not.toHaveText("0", { timeout: 30000 });
});

test("E-SEARCH-01 filter by live callsign", async ({ page, request }) => {
  const s = await request.get("/api/snapshot");
  expect(s.ok()).toBeTruthy();
  const body = await s.json();
  const cs = (body.tracks || []).map((t) => t.callsign).find(Boolean);
  expect(cs).toBeTruthy();
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Search flights").fill(cs.slice(0, 5));
  await expect(page.locator("#results li")).not.toHaveCount(0, { timeout: 15000 });
});

test("E-DETAIL-01 result click opens dossier", async ({ page, request }) => {
  const s = await request.get("/api/snapshot");
  const body = await s.json();
  const cs = (body.tracks || []).map((t) => t.callsign).find(Boolean);
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Search flights").fill(cs.slice(0, 5));
  await page.locator("#results li").first().click();
  await expect(page.locator("#pTitle")).not.toHaveText("Pick a flight", { timeout: 15000 });
});

test("E-EMPTY-01 no-match search state", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Search flights").fill("ZZZ999");
  await expect(page.locator("#results li")).toHaveCount(0);
});

test("E-MODES-01 switch Sea/Streets/Sky updates ticker", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Sea").click();
  await expect(page.locator("#noun")).toHaveText("afloat", { timeout: 30000 });
  await expect(page.locator("#count")).not.toHaveText("0", { timeout: 30000 });
  await modeBtn(page, "Streets").click();
  await expect(page.locator("#noun")).toHaveText("rolling", { timeout: 30000 });
  await modeBtn(page, "Sky").click();
  await expect(page.locator("#noun")).toHaveText("airborne", { timeout: 30000 });
});

test("E-SPACE-01 solar bodies render as large labeled markers", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Space").click();
  await expect(page.locator("#noun")).toHaveText("tracked", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__viewer && window.__viewer.entities.values.filter((e) => e.track && e.track.kind === "solar").length >= 10,
    null, { timeout: 60000 }
  );
  const kinds = await page.evaluate(() =>
    window.__viewer.entities.values
      .filter((e) => e.track && !e.cluster)
      .reduce((acc, e) => { const k = e.track.kind || "flight"; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  );
  expect(kinds.solar || 0).toBeGreaterThanOrEqual(10);
  expect(kinds.satellite || 0).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: "tests/reports/e2e-space.png" });
});

test("E-SPACE-02 solar tour visits bodies with dossier", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Space").click();
  await expect(page.locator("#tour")).toBeVisible({ timeout: 30000 });
  await page.locator("#tour").click();
  await expect(page.locator("#pTitle")).not.toHaveText("Pick a flight", { timeout: 15000 });
  await page.screenshot({ path: "tests/reports/e2e-tour.png" });
});
