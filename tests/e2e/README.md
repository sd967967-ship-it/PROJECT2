# E2E setup (Playwright, real browser)
1. `npm i -D @playwright/test` (root, done) then `npx playwright install chromium` (done).
2. Run (app server auto-reused on :3000, or set `E2E_BASE_URL`):
   `npx playwright test -c tests/e2e/playwright.config.js`.
3. Visibility screenshots land in `tests/reports/e2e-*.png` (gitignored).
Slow-network/offline profiles via `context.route` / `context.setOffline`.
