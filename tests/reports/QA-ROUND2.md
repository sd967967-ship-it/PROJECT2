# QA Round 2 — cycles 13–22, post-fix build (2026-09-27)

## Scope
Re-ran 10 cycles after fixes: baseLayer tiles, merged 8-hub fallback, clustering, Google default, yellow planes, logo theme, zoom controls, follow, trails, airports, 2D diff-update, render.yaml.

## Results
- Suites: 38/38 repo + 17/17 server every cycle (550 checks, 0 fail).
- Zoom: wheel + custom buttons verified working 10/10 (3D height deltas).
- Counts stable 815–825 (merged fallback; wild swings gone).
- JS errors: 0 all cycles. Failed requests: exactly 1 per cycle — `404 localhost:3000` = `/favicon.ico` (root-caused, fixed, verified 200 after restart).
- Screenshots 13/17/22: Google satellite earth, clusters, rail/dossier/ticker in navy theme, zoom controls visible.

## Residual (carried, not regressions)
- Feed still fallback (OpenSky 429); global density awaits quota reset or free account creds.
- E2E Playwright, axe-core, real-device, perf timings, lint/typecheck: still gaps (unchanged).
- Google direct tiles need Maps key for production (recorded).

## Verdict
Fixes verified. Proceeding to final 5-cycle confirmation round.
