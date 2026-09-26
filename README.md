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

## Daily sync — keeps every change thorough on all computers

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
