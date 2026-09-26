# AGENTS.md

## Purpose
Ground rules for any AI agent or human working in `C:\Users\sd967\PROJECT2` (repo `sd967967-ship-it/PROJECT2`).

## Stack quick facts
- Language: JavaScript (Node 22+, npm). Planned app code under `server/` + `public/` — not created yet.
- Existing code: `scripts/auto-sync.ps1` (PowerShell), `start-sync.bat`.
- Test command (when app exists): `npm test` in `server/`.
- Docs: `/docs` is external memory. Read order on session start: AGENTS → PROGRESS → PRD → HLD → LLD → ARCHITECTURE → TECHFLOW → WORKFLOW.

## Conventions
- File naming: kebab-case for scripts/docs; planned server files `server/src/<module>/<name>.js`.
- Folder structure (planned): `server/src/ingestion|fusion|capacity|pricing|services|broadcast/`, `server/data/*.json`, `server/test/*.test.js`, `public/` static Leaflet frontend, `docs/`.
- Commit style: `<type>: <short>` (`init`, `docs`, `feat`, `fix`). Example: `docs: auto-sync script, launcher, README`.
- Branch naming: `feat/<slug>`, `fix/<slug>`. Single user may push `main` directly; 2+ people use PRs (see WORKFLOW.md).

## Do
- Read `docs/PROGRESS.md` before any task; check `docs/LLD.md` for Interfaces before touching a Module.
- Update docs in the same turn as a meaningful change (API contract, schema, service, Module, decision, non-trivial bug).
- Keep each fact in one file; link instead of duplicating (e.g. "see LLD.md#fusion-module").
- Write tests for new logic under `server/test/`.
- Verify by running: `node --test` / single-cycle sync `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\auto-sync.ps1 -Once`.

## Don't
- Don't commit secrets (`.env`, `*.pem`, `*.key`, OpenSky passwords, API keys). Use env vars.
- Don't introduce a dependency without noting it in ARCHITECTURE.md.
- Don't let each browser tab call OpenSky/adsb.lol directly (quota). Backend polls once; see HLD.md.
- Don't claim live passenger counts or real fare history day-1 (see PRD.md non-goals).
- Don't full-repo scan when PROGRESS.md + LLD.md answer the question.
- Don't write app code until user lifts the code freeze (2026-09-26 instruction still active at doc creation).

## Escalate / ask before
- Schema changes (`TrackedFlight`, DB tables).
- New third-party feed or paid API.
- Anything touching auth, payments/affiliates, or publishing location data beyond ODbL/OpenSky ToS.
- Force-push, rebase of shared `main`, deleting history.
