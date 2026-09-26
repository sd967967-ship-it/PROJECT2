# Security & Privacy Checklist — SkyTrack

Run every cycle. Evidence: command output + file refs. Never use prod creds/data.

## Automated now (`tests/security/secrets.test.js`)
- [ ] No `api_key/apikey/secret/password/token/bearer` values in tracked `public/`, `tests/fixtures/`, `docs/` (names in docs ok, values not).
- [ ] No `OPENSKY_PASS`, private URLs, or feeder keys tracked. `git ls-files | xargs grep -i`.
- [ ] `.env` files untracked (`git check-ignore .env` must say ignored) — `.gitignore` covers `.env*`.

## Manual / review checklist
- [ ] Feeds: browser never calls OpenSky/adsb.lol directly (quota + key leak); only backend (see U-STATIC-04).
- [ ] Injection: search input rendered via `textContent` only — verify no `innerHTML` with user input (`app.js` uses innerHTML only for trusted mock fields; flag for E2E XSS probe later).
- [ ] Uploads/auth/payments: n/a (none exist) — re-check when added.
- [ ] Logging: no coords/PII in console in prod build (manual).
- [ ] Rate/abuse: single global poller invariant; note any per-client polling as High bug.
- [ ] Tiles/feeds attribution present (ODbL/OSM/OpenSky credit).
- [ ] PII deletion: n/a yet; revisit with favorites/login.
