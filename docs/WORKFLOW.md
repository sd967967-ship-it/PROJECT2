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
Phase gates in PROGRESS.md: map → detail → services/fares → ws → airport/search. Tag `v0.<phase>` per gate.

## Rollback process
`git revert <sha>` + redeploy; snapshot cache is ephemeral so rollback is stateless. Never force-push shared `main`.
