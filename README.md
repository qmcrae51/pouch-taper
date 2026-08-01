# Pouch Taper

Single-user, offline-first PWA for tapering off nicotine pouches to a fixed
quit date. One button logs a pouch; the app shows what's left today and when
the next one is allowed. All data lives in `localStorage` — no accounts, no
backend, no analytics, no runtime network calls.

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # engine + storage test suite
npm run build   # typecheck + production build with service worker
```

The plan engine (curve, scheduling, adjustments, travel mode, supply planner)
is pure functions under `src/engine/`, tested in isolation. Storage and
derived state live under `src/storage/`; screens under `src/ui/`.

Icons are generated, dependency-free, by `node scripts/gen-icons.mjs`.

## Deploy (GitHub Pages)

1. Create a GitHub repo and push this project to `main`.
2. In the repo settings, under **Pages**, set the source to **GitHub Actions**.
3. `.github/workflows/deploy.yml` tests, builds, and publishes on every push.

The Vite `base` is relative (`./`), so the build works under any repo path.

## Install on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. The app
runs standalone and fully offline after the first load (the service worker
precaches everything).

## Backups

Settings → Export JSON before travel or reinstalling. Import restores
everything losslessly.
