# Food Group Tracker

A phone app for the "tracking food groups" method: one box per serving, no calorie counting.
Runs as an installable web app (PWA). **No accounts, no server, no data leaves the phone.**

- `/` — the client app (install to home screen)
- `/configure/` — the dietitian's Configure Plan page; makes the link a client opens once

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

The Configure page works out the app address from where it's hosted, so nothing needs editing when you move to a custom domain.

## Local development

```
npm install
npm run dev              # http://localhost:5173 — install gate is on
VITE_REQUIRE_INSTALL=false npm run dev    # skip the install gate on desktop
npm test                 # plan encoding, schedules, conversion rules
npm run build && npm run preview
```

## Layout

- `src/model.js` — plan model, link encoding, schedules, exchange-conversion rules (pure, tested)
- `src/storage.js` — IndexedDB wrapper (the only persistence)
- `src/platform.js` — installed-app detection, `#plan=` link reading, install prompt
- `src/App.jsx` — state, day log, view routing
- `src/ui/*` — screens: Install, Setup, Onboarding, Today, Plan, AddFood, Log, History
- `public/configure/index.html` — the dietitian's page (self-contained)

## Testing checklist (both phones)

- Open the app URL in the browser → install gate shows the right steps; nothing can be logged yet.
- Install → open from home screen → setup (paste a plan link) → onboarding → Today.
- Open a plan link from a text message: Android opens the app and applies it; iPhone opens Safari, "Copy plan link" → paste on the Plan screen.
- Airplane mode: app still opens and logs.
- Next day: yesterday appears in History with the right plan; a scheduled variant is pre-selected.
- History → Back up → file saved; Restore on a second device reproduces everything.
