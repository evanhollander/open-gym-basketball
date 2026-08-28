# Open Gym Basketball

A React + TypeScript port of [fdarosa.com/open-gym-basketball.html](https://www.fdarosa.com/open-gym-basketball.html) - a courtside pickup-basketball team manager: add players, auto-assign fair teams across up to 4 courts, run "winner stays on" rounds, and drag players between team slots and the bench.

Settings let you tune the game format per session: Minimum Game (2v2-5v5), an optional Max Team Size cap, Number of Courts, Max Players on 1 Court (before splitting into a 2nd court), the Winner Stays On consecutive-win cap, and light/dark/system theme.

See [OPEN_GYM_LOGIC.md](./OPEN_GYM_LOGIC.md) for the full behavioral spec this port is built from, including what's new (a "Max Team Size" cap) and what was fixed vs. the original.

No backend - all state lives in the browser's `localStorage`, same as the original. It's also an installable PWA (works offline once loaded, auto-updates in the background on the next visit after a new deploy).

## Development

```bash
npm install
npm run dev          # start the dev server
npm test             # run the test suite (Vitest)
npm run test:watch   # Vitest in watch mode
npm run lint         # oxlint
npm run build        # type-check + production build
npm run preview      # serve the production build locally (needed to test PWA/service-worker behavior)
```

## Deployment

Pushes to `main` are *supposed* to auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`, but the push-triggered webhook has occasionally failed to fire. Verify a push actually deployed with:

```bash
gh run list --repo evanhollander/open-gym-basketball --limit 1
```

If nothing shows up for a recent push, trigger it manually:

```bash
gh workflow run "Deploy to GitHub Pages" --repo evanhollander/open-gym-basketball --ref main
```
