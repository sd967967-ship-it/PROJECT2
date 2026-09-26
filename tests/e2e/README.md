# E2E setup (Playwright, later)
1. `npm init -y` (root, if accepted) then `npm i -D @playwright/test` — record in ARCHITECTURE.md when done.
2. `npx playwright install chromium`.
3. Serve landing: `python -m http.server 8080 --directory public`.
4. `npx playwright test -c tests/e2e/playwright.config.js`.
Uncomment specs in `tests/e2e/flows.spec.js`. Slow-network/offline profiles via `context.route` / `context.setOffline` (see NETWORK-OFFLINE-PLAN.md).
