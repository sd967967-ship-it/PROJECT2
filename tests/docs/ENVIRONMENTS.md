# Test Environments — SkyTrack

| Env | URL / target | Data | Network |
|-----|--------------|------|---------|
| local-unit | `node --test tests/unit` | fixtures | none |
| local-integration | ephemeral `127.0.0.1` mock feed | fixtures | mock modes incl. slow/off |
| local-ui | `python -m http.server 8080 --directory public` + manual browser | mock snapshot in page | devtools offline/throttle manual |
| e2e (later) | Playwright + static server | fixtures via route interception | Playwright offline/slow profiles |
| staging/prod | n/a yet | — | no automated runs against prod feeds |

## Variables (`tests/.env.example`, never real values)
`TEST_ENV=true`, `API_BASE_URL=http://127.0.0.1:0`, `USE_MOCK_API=true`,
`TEST_USER_EMAIL=test@example.com`, `TEST_USER_PASSWORD=CHANGEME-LOCAL-ONLY`.
Load via `tests/config/env.js` (env vars override file; CI secrets override all).
