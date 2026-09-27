// E2E flows (Playwright, real browser). Base URL = app server (API + static).
// Run: npx playwright test -c tests/e2e/playwright.config.js
// Canvas globe: prefer role/DOM locators + entity inspection over canvas clicks.
const { test, expect } = require("@playwright/test");

function benignConsole(text) {
  // Live movers churn: a detail fetch can 404 between search and click. The app
  // shows a "No longer tracked" notice (contract-tested server-side), so only
  // unexpected 404s fail the run.
  return /about:blank.*sandboxed|allow-scripts|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_TIMED_OUT/.test(text)
    || /Failed to load resource:.*\/api\/(flights|vessels|vehicles|objects)\/.* 404/.test(text);
}
function modeBtn(page, name) {
  return page.getByRole("group", { name: "Tracking mode" }).getByRole("button", { name, exact: true });
}

test.beforeEach(async ({ page }) => {
  page._jsErrors = [];
  page.on("pageerror", (e) => page._jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !benignConsole(m.text())) page._jsErrors.push("console: " + m.text()); });
  // Blocked first-party/library requests are app bugs; tile CDNs flap, so only
  // localhost + library CDNs fail the run (tile reachability has its own check).
  page.on("requestfailed", (r) => {
    if (/^(http:\/\/localhost:3000|https:\/\/(unpkg\.com|cdn\.jsdelivr\.net))\//.test(r.url())) {
      page._jsErrors.push("REQFAIL: " + r.url().slice(0, 120));
    }
  });
  // domcontentloaded: tile/CDN subresources must not gate the suite (they retry in-app).
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test.afterEach(async ({ page }) => {
  expect(page._jsErrors).toEqual([]);
});

test("E-APP-01 launch renders globe + count", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("#count")).not.toHaveText("0", { timeout: 30000 });
  // Tile hosts must pass our own CSP: a blocked tile fetch means a black globe.
  const tileOk = await page.evaluate(async () => {
    try {
      const r = await fetch("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/2/1/1");
      return r.ok;
    } catch { return false; }
  });
  expect(tileOk).toBeTruthy();
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
  const pickCallsign = async () => {
    const s = await request.get("/api/snapshot");
    const body = await s.json();
    return (body.tracks || []).map((t) => t.callsign).find(Boolean);
  };
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  for (let attempt = 0; attempt < 2; attempt++) {
    const cs = await pickCallsign();
    await page.getByLabel("Search flights").fill(cs.slice(0, 5));
    await page.locator("#results li").first().click();
    await expect(page.locator("#pTitle")).not.toHaveText("Pick a flight", { timeout: 8000 });
    const title = await page.locator("#pTitle").textContent();
    if (title !== "No longer tracked") return; // opened for real; stale otherwise → re-search once
  }
  throw new Error("dossier never opened");
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

test("E-SPACE-03 heliocentric scene activates with Sun and planets", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Space").click();
  await page.waitForFunction(() => window.__viewer && window.__viewer.scene.globe.show === false, null, { timeout: 60000 });
  const scene = await page.evaluate(() => {
    const ids = window.__viewer.entities.values.map((e) => e.id);
    return {
      sun: ids.includes("sol-solar-sun"),
      planets: ["sol-solar-mercury", "sol-solar-venus", "sol-solar-mars", "sol-solar-jupiter", "sol-solar-saturn", "sol-solar-uranus", "sol-solar-neptune"].filter((id) => ids.includes(id)).length,
      rings: ids.filter((id) => String(id).startsWith("sol-ring-")).length,
    };
  });
  expect(scene.sun).toBeTruthy();
  expect(scene.planets).toBe(7);
  expect(scene.rings).toBeGreaterThanOrEqual(7);
  const hidden = await page.evaluate(() => {
    const gl = window.__viewer.entities.values.filter((e) => e.track && !String(e.id).startsWith("sol-"));
    return { globe: gl.length, hidden: gl.filter((e) => e.show === false).length, atmo: window.__viewer.scene.skyAtmosphere.show };
  });
  expect(hidden.globe).toBeGreaterThan(0);
  expect(hidden.hidden).toBe(hidden.globe);
  expect(hidden.atmo).toBe(false);
  await page.screenshot({ path: "tests/reports/e2e-solar.png" });
});

test("E-LAYERS-01 quake overlay renders, ports toggle on", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.locator("#layerPanel > summary").click();
  const quakes = await page.evaluate(() =>
    window.__viewer.entities.values.filter((e) => e.overlay && e.overlay.group === "quakes").length);
  expect(quakes).toBeGreaterThan(0);
  await page.locator('input[data-layer="ports"]').check();
  await page.waitForFunction(
    () => window.__viewer.entities.values.filter((e) => e.overlay && e.overlay.group === "ports").length > 5,
    null, { timeout: 30000 });
  await expect(page.locator("#layerCount")).not.toHaveText("", { timeout: 30000 });
});

test("E-STREETS-01 rail/metro/bus filter separates systems", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Streets").click();
  await expect(page.locator("#noun")).toHaveText("rolling", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__viewer.entities.values.filter((e) => e.track && e.track.meta && e.track.meta.system === "bus").length > 0,
    null, { timeout: 60000 });
  const before = await page.evaluate(() =>
    window.__viewer.entities.values.filter((e) => e.track && !e.cluster).length);
  expect(before).toBeGreaterThan(0);
  await page.locator("#layerPanel > summary").click();
  await page.locator('input[data-system="bus"]').uncheck();
  await page.waitForFunction(
    () => window.__viewer.entities.values.filter((e) => e.track && e.track.meta && e.track.meta.system === "bus").length === 0,
    null, { timeout: 30000 });
  const rail = await page.evaluate(() =>
    window.__viewer.entities.values.filter((e) => e.track && e.track.meta && e.track.meta.system === "rail").length);
  expect(rail).toBeGreaterThan(0);
  await page.screenshot({ path: "tests/reports/e2e-streets.png" });
});

test("E-SOLAR-04 animation plays, pauses, and lists bodies", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Space").click();
  await page.waitForFunction(() => window.__viewer && window.__viewer.scene.globe.show === false, null, { timeout: 60000 });
  await page.locator("#layerPanel > summary").click();
  await page.locator("#simPlay").click();
  await expect(page.locator("#simBadge")).toContainText("Simulating", { timeout: 30000 });
  await expect(page.locator("#solarRows tr")).not.toHaveCount(0, { timeout: 30000 });
  await page.locator("#simPlay").click();
  await expect(page.locator("#simBadge")).toHaveText("Live positions", { timeout: 15000 });
});

test("E-BOARD-01 stop search opens live board or honest fallback", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await modeBtn(page, "Streets").click();
  await page.locator("#layerPanel > summary").click();
  await page.locator('input[data-layer="stops"]').check();
  await page.waitForFunction(
    () => window.__viewer.entities.values.filter((e) => e.overlay && e.overlay.group === "stops").length > 5,
    null, { timeout: 30000 });
  await page.getByLabel("Search flights").fill("Oslo Central");
  await page.locator("#results li", { hasText: "Oslo Central" }).click();
  await expect(page.locator("#pServices li")).not.toHaveCount(0, { timeout: 15000 });
});

test("E-WX-01 view-center weather reads out honestly", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.locator("#layerPanel > summary").click();
  await page.locator("#wxGo").click();
  await expect(page.locator("#wxOut")).not.toHaveText("Not queried yet.", { timeout: 30000 });
});

test("E-STATUS-01 parked layers read unavailable, never live", async ({ page }) => {
  await expect(page.locator("#globe canvas")).toBeVisible({ timeout: 60000 });
  await page.locator("#layerPanel > summary").click();
  await expect(page.locator("#layerRows")).toContainText("unavailable", { timeout: 30000 });
  const badge = await page.locator("#layerCount").textContent();
  expect(badge).toMatch(/[0-9]+\/[0-9]+ live/);
});
