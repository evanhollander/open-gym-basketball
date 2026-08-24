# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + TypeScript port of a single-file legacy HTML app (`OPEN_GYM_LOGIC.md` in this repo is the full behavioral spec of that original — read it before changing fairness/rotation logic, since it documents *why* the algorithm works the way it does, which bugs were deliberately fixed vs. faithfully preserved, and what's new vs. the original). It's a courtside pickup-basketball team manager: add players, auto-assign fair teams across up to 4 courts, run "winner stays on" rounds, drag players between team slots and the bench. No backend — all state lives in the browser's `localStorage`.

## Commands

```bash
npm install
npm run dev          # dev server
npm run build        # tsc -b && vite build (type-check is part of the build)
npm test             # vitest run (single run, all tests)
npm run test:watch   # vitest, watch mode
npm run lint         # oxlint
npm run preview      # serve the production build locally (needed to test PWA/service-worker behavior - the dev server doesn't register it)
```

Run a single test file: `npx vitest run src/state/rotation.test.ts` (or drop `run` for watch mode on that file). Test files are colocated with what they test, split by concern rather than one giant file: `distribution.test.ts`, `assignTeams.test.ts`, `rotation.test.ts`, `movePlayer.test.ts` (all against `gameLogic.ts`), `gameLogic.test.ts` (roster CRUD), `dragDrop.test.ts`.

Type-checking `tsc -b --noEmit` is worth running standalone during iteration since `npm run build` also does a full Vite build.

## Architecture

**State is one big object, mutated by one reducer, mirrored to localStorage.** `src/types.ts` defines the entire `GameState` shape (players, teams, courts, settings, round/fairness counters) and the `Action` union in a single file — read it first when touching anything. `src/state/context.tsx` wires a plain `useReducer` + a `useEffect` that persists the whole state blob to `localStorage` after every dispatch; `src/state/persistence.ts` does the load/save. There's no data fetching and no backend — every action is synchronous.

**All business logic lives in one file, `src/state/gameLogic.ts`, organized by numbered section comments (1. Roster, 2. Court distribution, 3. Shuffle cascade, 4. Assign teams, 5. Winner-stays rotation, 6. Manual player movement/drag-and-drop).** This is deliberate, not something to "clean up" by splitting into many files — it exists so the whole game-logic surface can be read top-to-bottom in one pass, mirroring how `OPEN_GYM_LOGIC.md` documents the original single-file app. `src/state/reducer.ts` is intentionally a thin dispatcher with a switch statement calling into `gameLogic.ts` — never put business logic in the reducer itself.

**Court/team data model**: 4 courts and 8 teams always exist (`court-1`..`court-4`, `team-1`..`team-8`), regardless of how many are actually in play — `court.active`/`court.sizePerTeam` (derived by `distributePlayers`/`applyDistribution` in `gameLogic.ts` from player count + settings) control what's actually rendered. Every `Team.slots` array is a fixed length of 5 *regardless of the court's current size* — components slice to `court.sizePerTeam` when rendering/filling. This was a deliberate fix: an earlier version resized the slots array to match court size, which caused players to silently vanish (stuck in an out-of-range index) whenever a court shrunk between assignments. Don't reintroduce dynamic-length slot arrays.

**Players have stable UUIDs, not positional indices** (the original app used position-based DOM ids like `name17` and had to renumber everyone on removal — this port never needs to).

**The "is a round currently active" question must be answered by checking `players.some(p => p.status === 'team')`, never by checking `round > 0` or similar counters.** Actions like Clear Teams / Clear # Games Sat can change team assignment or the round counter independently of each other, so any code that gates behavior on "has a round started" (UI visibility in `GameControls.tsx`/`RotationBoard.tsx`, the guard in `updateWins`) needs to check actual team assignment. Getting this inconsistent between two places was the direct cause of two real shipped bugs — if you add a new state field that changes when teams are assigned/cleared, check whether this invariant still holds.

**Fairness/rotation algorithm** (`gameLogic.ts` sections 3-5): candidates for filling an open team slot are drawn from a tiered, shuffled pool (`buildCandidateOrder`) that prioritizes players who've sat the longest; `assignTeams` fills every empty slot from that pool; `updateWins` implements "winner stays on" with a consecutive-win cap, cascading winners up through courts. `truncateOversizedTeams` (called at the top of `assignTeams`) handles a court shrinking between assignments (e.g. a new Max Team Size cap) — it must remove players by *lowest sit-count first*, never by raw array position, and must compact the remaining slots to low indices — both of those non-obvious requirements come from real bugs (re-benching someone who'd just been fairly rotated in; a kept player stranded at an out-of-range index). Read the comments on `truncateOversizedTeams` before touching it.

**Drag-and-drop**: `RotationBoard.tsx` owns the single `DndContext` (dnd-kit) for the whole board. `src/dragDrop.ts`'s `resolveDropAction` is a small pure function extracted specifically so the drop-target logic can be unit-tested without driving dnd-kit's pointer internals (which are effectively untestable in a headless test runner) — all actual move-legality rules live in `movePlayer` (`gameLogic.ts` section 6), not in the drag handlers.

**Settings that affect court/team sizing require re-running Assign Teams or Reshuffle Teams to take effect** — changing a setting alone doesn't retroactively recompute already-assigned teams (only `applyDistribution`, called from `assignTeams`, does that).

**Mobile input gotcha**: never use a free-text `<input type="number">` for a small bounded range. Tapping to edit on mobile doesn't select the existing digit, so typing appends instead of replacing (e.g. "1" + tap + "2" → "12"), which silently clamps to whatever the max is. Every numeric setting in `SettingsPanel.tsx` is a `<select>` for this reason — this bit us more than once before that convention was established.

**PWA**: `vite-plugin-pwa` (configured in `vite.config.ts`) generates the manifest and a Workbox service worker with `registerType: 'autoUpdate'` — a new deploy is picked up automatically on next load, no manual cache-busting needed. Icons are generated from SVG sources via `scripts/generate-icons.mjs` (uses `sharp`) — regenerate with `node scripts/generate-icons.mjs` if the source icons change, don't hand-edit the PNGs in `public/`.

**Theming**: Tailwind v4's `dark:` variant is overridden in `src/index.css` (`@custom-variant dark (&:where(.dark, .dark *));`) to respond to a `.dark` class instead of only `prefers-color-scheme` — `ThemeManager.tsx` applies that class based on the Settings > Appearance choice (System/Light/Dark), and follows OS changes live when set to System.

**Deployment**: pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. `vite.config.ts`'s `base` must match the repo name (`/open-gym-basketball/`) since Pages serves from a subpath — if the repo is ever renamed, update `base` accordingly.
