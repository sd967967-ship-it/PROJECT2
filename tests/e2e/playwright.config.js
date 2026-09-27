// Playwright config: real-browser E2E against the app server (API + static).
// Run: npx playwright test -c tests/e2e/playwright.config.js
module.exports = {
  testDir: "./",
  testMatch: "flows.spec.js",
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node server/src/index.js", port: 3000, reuseExistingServer: true, timeout: 60000 },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 900 } } }, { name: "mobile", use: { viewport: { width: 360, height: 640 } } }],
};
