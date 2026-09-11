# Food Group Tracker

A phone app for the "tracking food groups" method: one box per serving, no calorie counting.
Runs as an installable web app (PWA). **No accounts, no server, no data leaves the phone.**

- `/` — the client app (install to home screen)
- `/configure/` — the dietitian's Configure Plan page; makes the link a client opens once

**New to this? Read [SETUP.md](SETUP.md) instead. It's the step-by-step, no-command-line version of everything below.**

## Deploy (GitHub Pages, free)

1. Create a new GitHub repository (any name; `food-group-tracker` recommended). Don't add a README.
2. Push this folder to it:
   ```
   git init && git add -A && git commit -m "Food Group Tracker"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. The included workflow builds and deploys on every push to `main`. First run takes a couple of minutes.
5. Your app is at `https://<you>.github.io/<repo>/` and the Configure Plan page at `https://<you>.github.io/<repo>/configure/`.

The Configure page works out the app address from where it's hosted.

### Address without a username

Create a free GitHub organization (e.g. `foodgrouptracker`), transfer the repo into it, and rename the repo to
`foodgrouptracker.github.io`. GitHub then serves the app at `https://foodgrouptracker.github.io/`. The build detects
the `*.github.io` repo name and serves from the root automatically.

### Custom domain (optional)

Add a `public/CNAME` file containing the domain, set the same domain in Settings → Pages → Custom domain, and point
DNS at GitHub Pages (four `A` records for the apex, a `CNAME` for `www`). With that file present the build serves from
the domain root.
