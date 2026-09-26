# Test Strategy — SkyTrack (PROJECT2)

Status: static Leaflet landing (`public/`) + mock snapshot; `server/` not built yet. Strategy covers present UI + planned Node/`ws` backend without touching app code.

## Stack (test-only, zero new app deps)
- Unit/integration/static: Node built-in `node:test` + `node:assert/strict`. Run offline, no install.
- E2E: Playwright skeleton (`tests/e2e/*.spec.js`, `playwright.config.js`). NOT installed; needs `npx playwright install` before use.
- A11y automation (later): axe-core via Playwright. Manual checklist now in `tests/docs/ACCESSIBILITY-PLAN.md`.

## Pyramid
1. Static contract tests (fast, always green): assert `public/` keeps Leaflet layers, detail IDs, ws hook, no secrets, no per-tab feed calls.
2. Unit: pure logic in `tests/helpers/` mirroring LLD contracts (geo, fares, capacity) + edge/invalid input.
3. Integration: mock HTTP feed (modes ok/empty/429/slow/invalid) → fetch/normalize/backoff/timeout, offline + stale-cache behavior. No prod data, no paid calls.
4. E2E (Playwright, later): launch, search, detail, empty/loading/error, small-screen, slow-network.

## Isolation rules
- Test-only dirs: `tests/`, `.github/workflows/qa-tests.yml`. Never edit `public/`, `server/` (when built), `scripts/` for tests.
- External feeds: only mocks/fixtures in tests. Real OpenSky/adsb.lol calls are manual, rate-limited, and never in CI.
- Secrets: placeholders only (`tests/.env.example`). Real keys via env/CI secrets, never tracked.

## Quality gates (later CI)
`node --test tests/unit tests/integration tests/a11y tests/perf tests/security tests/regression` green; Playwright suite green before release tag.
