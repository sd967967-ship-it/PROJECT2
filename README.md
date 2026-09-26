# PROJECT2

Shared repo for multi-computer workflow (Option B).

## Setup on each Windows PC

```powershell
cd $env:USERPROFILE
git clone https://github.com/sd967967-ship-it/PROJECT2.git
cd PROJECT2
opencode
```

Git identity (once per PC):

```powershell
git config --global user.name "Aryan"
git config --global user.email "sd967967@gmail.com"
```

Auth uses HTTPS + Git Credential Manager. Sign in with GitHub when prompted.

## Automatic sync — ~10s both directions (Windows)

One-time per PC:

```powershell
cd $env:USERPROFILE\PROJECT2
git config pull.rebase true
git config rebase.autoStash true
git pull --rebase
```

Start auto-sync (runs until closed):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\auto-sync.ps1
```

Or double-click `start-sync.bat`. Keep the window open while working.
Single cycle test: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\auto-sync.ps1 -Once`

Log: `.git/auto-sync.log`. If it prints CONFLICT, run `git status`, fix files, `git rebase --continue`, then it resumes.

## Manual sync (fallback)

Start work:
```powershell
git fetch
git pull --rebase
```

Finish work:
```powershell
git add -A
git status
git commit -m "describe change"
git push
```

On the other PC:
```powershell
git pull --rebase
```

Rules:
1. Always pull before starting, push before switching PCs.
2. Single user can push to `main`. For 2+ people use branches + PRs.
3. Shared OpenCode config is `opencode.json` in this repo. Local `cli.json` and API keys stay per-PC, never commit secrets.

## Deploy (Render free)

```powershell
cd $env:USERPROFILE\PROJECT2\server
npm ci
npm start  # serves http://localhost:3000
```

Push to GitHub, create a Render Web Service from this repo (`render.yaml` at root wires it: build `npm ci`, start `npm start`, health `/api/health`). Set `OPENSKY_USER`/`OPENSKY_PASS` in Render env for 10x feed quota (free OpenSky account); without them the app runs anonymous + fallback. Copy `server/.env.example` to `server/.env` for local secrets.
