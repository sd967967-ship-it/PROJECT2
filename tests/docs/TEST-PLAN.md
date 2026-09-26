# Test Plan — SkyTrack

## Scope
In: `public/` landing (map, search, detail panel, layers), LLD contracts (Ingestion/Fusion/Capacity/Pricing/Broadcast shapes), failure/offline/a11y/perf/security checklists.
Out: fixing product bugs, load-testing prod feeds, real-payment/affiliate flows (none exist).

## Suites & locations
| Suite | Dir | Runner | Needs |
|-------|-----|--------|-------|
| Unit | `tests/unit/` | `node --test` | nothing |
| Integration (mock feed) | `tests/integration/` | `node --test` | nothing (localhost mock) |
| Static a11y/perf/security | `tests/a11y|perf|security/` | `node --test` | nothing |
| Regression smoke | `tests/regression/` | `node --test` | nothing |
| Network contract | `tests/network/` | `node --test` | nothing |
| E2E | `tests/e2e/` | Playwright | `npm i -D playwright`, `playwright install`, static server |

## Entry/exit criteria
- Entry: `git status` clean baseline recorded; fixtures frozen under `tests/fixtures/`.
- Exit per cycle: report per `tests/reports/TEST-REPORT.md`, bugs per `tests/reports/BUG-REPORT.md`, run log line per `tests/reports/RUN-LOG.md`.

## Cycles protocol
Full-suite runs only on explicit request. Before running, ask: “How many complete test cycles would you like me to run?” Then run exactly N cycles per the repo QA protocol (env verify → lint → typecheck (n/a) → unit → integration → e2E → error/offline → UI → a11y → perf → security → regression → build verify).
