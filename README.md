# Open Gym Basketball

A React + TypeScript port of [fdarosa.com/open-gym-basketball.html](https://www.fdarosa.com/open-gym-basketball.html) - a courtside pickup-basketball team manager: add players, auto-assign fair teams across up to 4 courts, run "winner stays on" rounds, and drag players between team slots and the bench.

See [OPEN_GYM_LOGIC.md](./OPEN_GYM_LOGIC.md) for the full behavioral spec this port is built from, including what's new (a "Max Team Size" cap) and what was fixed vs. the original.

No backend - all state lives in the browser's `localStorage`, same as the original.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite (Vitest)
npm run build    # type-check + production build
```

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`.
