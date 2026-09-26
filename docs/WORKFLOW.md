# Dev Workflow

## Branching model
- `main` is deployable. Single user may push `main`; 2+ people: `feat/<slug>` → PR → squash.
- Existing multi-PC sync: `scripts/auto-sync.ps1` every 10s (fetch → pull --rebase --autostash → add/commit/push). Log `.git/auto-sync.log`. On CONFLICT: `git status`, fix, `git rebase --continue`. See `README.md`.

## PR checklist
- [ ] `npm test` green in `server/`
- [ ] No secrets; `.env` untouched
- [ ] LLD.md Interface table updated if contract changed
- [ ] PROGRESS.md entry added same turn
- [ ] Viewport quota respected (no client→feed calls)

## CI/CD steps
1. Local: `npm test`, `node server/src/index.js` smoke, `.../auto-sync.ps1 -Once` for sync check.
2. Push → host builds (`npm ci`) → serves on `$PORT`.
3. Free-tier cold start accepted; UptimeRobot ping optional.

## Release process
Phase gates in PROGRESS.md: map → detail → services/fares → ws → airport/search → domains (space/solar, sea, streets). Tag `v0.<phase>` per gate.

## Domain activation (multimodal)
Activating a parked Adapter is config-only, never code: add feed URL/key to host env (see ARCHITECTURE.md slots), add fixture rows + contract test, update LLD.md registry + PROGRESS.md. Checklist: [ ] no secrets in repo [ ] polite rate + cache [ ] attribution shown in UI [ ] fallback when feed dies.

## Rollback process
`git revert <sha>` + redeploy; snapshot cache is ephemeral so rollback is stateless. Never force-push shared `main`.
