# Tests — SkyTrack

Test-only setup. App code lives in `public/` (+ future `server/`); nothing here ships.

## Commands (later; NOT run now)
- All runnable suites: `node tests/run.js`
- One suite: `node tests/run.js unit` (or integration, network, a11y, perf, security, regression)
- Direct: `node --test tests/unit tests/integration tests/network tests/a11y tests/perf tests/security tests/regression`
- E2E (needs install first): see `tests/e2e/README.md`

## Layout
`docs/` strategy→cases→plans | `config/env.js` | `helpers/` test-only mirrors | `fixtures/` synthetic |
`mocks/` feed+ws | `unit|integration|network|a11y|perf|security|regression/` runnable |
`e2e/` Playwright skeleton | `reports/` templates | `visual/` plan (manual for now)

## Rules
Mocks/fixtures only — no prod data, keys, or paid feed calls. Full runs only on explicit request.
