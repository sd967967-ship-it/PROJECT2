// Playwright config (skeleton — requires `npm i -D @playwright/test` + `npx playwright install`).
// Static server: python -m http.server 8080 --directory public
module.exports = {
  testDir: "./",
  testMatch: "*.spec.js",
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:8080", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 900 } } }, { name: "mobile", use: { viewport: { width: 360, height: 640 } } }],
};
