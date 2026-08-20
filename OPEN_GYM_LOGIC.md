# Open Gym Basketball — Logic Reference

Source: `https://www.fdarosa.com/open-gym-basketball.html` (© Fernando da Rosa, v8.20.25).
Single static HTML file, all logic in one inline `<script>`, no backend — state lives in `localStorage` and the DOM (values are read/written via `innerHTML`/`.value` on specific element IDs). This doc captures the *behavior* so it can be ported to a real data model (e.g. React state / a `Player`/`Team` object model) instead of ID-keyed DOM strings.

## Core concepts

- **Players** are numbered 1–50 (fixed max). Each player has: `name`, `play` status, `sit` count, `round` (last round sat/updated).
- **Play status** (`play<N>` field) is one of: `None`, `Team N` (playing, e.g. `"Team 1 (White)"`), `Sitting`, `Next`, `Holding`, `Pending`.
- **Courts**: 1–4 courts, each hosting 2 teams (Court 1 → Teams 1/2, Court 2 → Teams 3/4, Court 3 → Teams 5/6, Court 4 → Teams 7/8).
- **Game type** (`gametype`, aka "Minimum Game"): 2v2 / 3v3 (default) / 4v4 / 5v5 — drives when a second/third/fourth court activates based on player count.
- **Rounds**: a counter incremented each time teams are (re)assigned via "Add to Teams" (not on reshuffle-keep-teams).
- **Sitting queue**: up to 20 slots (`sitnum-1..20` / `sit-1..20`) showing players currently not on a team.
- **Last Sat**: last 10 players who sat out, tracked to avoid making the same players sit twice in a row.
- **Max Sit** (`max-sit`): the highest "times sat" count seen; used as a threshold — a player isn't benched again until others catch up to that count (fair rotation).
- **Max Wins** (`max-wins`, default 2): consecutive-win cap on Court 1 — force the winning team to sit once they hit it (avoids one team dominating).

All persisted fields (mirrors of DOM state) are saved to `localStorage` on every mutation: `num_players`, `rounds`, `court1-winner`, `court1-wins`, `max-sit`, `gametype`, `playcourts`, per-player `name/play/sit/round`, per-team-slot `num<team>-<slot>/team<team>-<slot>`, per-sit-row `sitnum-<n>/sit-<n>`, and `last1..last10`.

---

## 1. Court / team-size distribution

### `distributePlayers()`
Given `courts` (1–4) and `players` (total count) and `type` (game type), compute how many players per team on each active court (`court1`..`court4`, default 5 each, 0 = inactive):

- Court 1 solo (courts==1): defaults to 5; drops to 3 if `6–7` players, 4 if `8–9` players. Alerts to split into 2 courts if `players > 12` and `type > 3` (4v4/5v5).
- **2+ courts**, thresholds depend on `type`:
  - `type==3` (3v3 default): 12–13→(3,3), 14–15→(4,3), 16–17→(4,4), 18–19→(5,4), ≥20→(5,5)
  - `type==2` (2v2): 14–15→(5,2), 16–17→(4,4), 18–19→(5,4), ≥20→(5,5)
  - `type==4` (4v4): 16–17→(4,4), 18–19→(0,4) [court2 only fills, court1 stays default 5... see caveat below], ≥20→(0,5)
  - `type==5` (5v5): ≥20→(0,5)
  - Toggles visibility of the Court 2 UI block / winner-select accordingly.
- **3rd court** (courts≥3): 26–27→3, 28–29→4, ≥30→5 players/team; toggles Court 3 UI.
- **4th court** (courts≥4): 36–37→3, 38–39→4, ≥40→5 players/team; toggles Court 4 UI.
- Writes the four per-court team sizes into `court1num..court4num`.

> Port note: this is a lookup table, not a formula — reimplement as an explicit table/switch keyed by `(courts, type, playerCountBand)`. There are inconsistencies in the original (e.g. `type==4/5` branches leave `court1` at 5 even when only court2 seems intended) — worth deciding intended behavior when porting rather than copying the bug.

### `addCourts()` / `changeCourts()`
Show/hide Court 2/3/4 UI panels based on `playcourts` and `num_players` (simpler two-court-count-only threshold: >15 for court2, >25 for court3, >35 for court4). Persists `playcourts`. `changeCourts()` also warns "Reshuffle Teams may be needed" if a round is in progress.

---

## 2. Roster management

### `addPlayer()`
- Reads new name from input; requires ≥2 chars; rejects duplicates (case-sensitive exact match against existing `name<n>` values); caps at 50 players.
- Appends as next player number, `play` = `"None"`, `sit` = `1` if a round is already in progress (so they don't unfairly jump the queue) else `0`, `round` = current round.
- Calls `distributePlayers()` first (recomputes court sizes) then saves.

### `RemovePlayer(playerId)`
- Removes player `num`, decrements `num_players`.
- **Auto-replacement**: for every team slot containing the removed player, pulls a replacement from the shuffle queue (`shuffleNextPlayers()` → fallback `shuffleSittingPlayers()`), respecting the `max-sit` threshold (if the next candidate has already sat ≥ max, mark them `"Holding"` and try the next one instead of playing them again immediately). Alerts if no replacement is available.
- Removes the player (and their replacement's old sitting-row) from the sitting list.
- **Renumbers**: every player above the removed index shifts down by one (id `i` → `i-1`), including their team-slot and sitting-slot references — this keeps player numbers contiguous 1..N.
- Emits warnings when removal crosses a team-size breakpoint (16/18/20 for 2 courts, 26/28/30 for 3, 36/38/40 for 4) since `distributePlayers()` thresholds would change.

### `clearPlayers()` / `resetAll()`
Wipe all 50 player rows (name/play/sit/round → blank) and `localStorage.clear()`; `resetAll()` also resets `max-sit`→1, `rounds`→0, court1 winner/streak, and calls `clearTeams()`.

---

## 3. Team assignment — the shuffle pipeline

A single scratch array (`array`/`shuffledArray`, module-level) is filled then Fisher–Yates shuffled (`shuffleArray`) each time a pool of "candidate players to place" is needed. There's a **priority cascade** of pool-builder functions, each one a superset of the last, called in fallback order whenever the current pool runs out:

1. **`shuffleTeamPlayers()`** — pool = players currently `play.includes("Team")` (used only for `reshuffleTeams()`, i.e. keep same players, just re-scramble team assignments).
2. **`shuffleNextPlayers()`** — the main pool for a *new* game. Computes how many players are needed for active courts (`(court1+court2+court3+court4)*2`); anyone beyond that becomes `"Sitting"`. Includes players who are `Sitting` **and** have sat ≥ `max-sit` times, or `None`/`Next` under the same sit-count rule (else marks them `"Holding"` — eligible later but not yet, to keep rotation fair).
3. **`shuffleSittingPlayers()`** — broader: any `Next`/`None`/`Sitting` regardless of sit count. Falls back to (4) if empty.
4. **`shufflePendingPlayers()`** — adds `Pending` status too. Falls back to (5) if empty.
5. **`shuffleRemainingPlayers()`** — widest: adds `Holding` status too (essentially "anyone not actively playing").

This models: *prefer players who've sat the most / longest; only reach into "Holding" players (recently played or recently sat) as a last resort.*

### `assignTeams(keepteams)`
Main entry point (`"Add to Teams"` button calls `assignTeams(0)`, i.e. `keepteams` falsy).
1. Requires ≥6 total players (else alert).
2. `distributePlayers()` to (re)compute court sizes.
3. Build the initial candidate pool: `keepteams` truthy → `shuffleTeamPlayers()` + `clearTeams()` (re-scramble existing players' slots); else `shuffleNextPlayers()` (fresh pool, respecting sit-count fairness). Falls back to `shuffleSittingPlayers()` if the pool is empty.
4. **Fill each team's slots in fixed order**: Team 1 → Team 2 → Team 3 → Team 4 → Team 5 → Team 6 → Team 7 → Team 8 (only for courts that are active), skipping slots already filled (non-blank). For each empty slot:
   - Pop `shuffledArray[next]` as the candidate.
   - Fairness check: if `rounds > 0` and the candidate did **not** sit last round (`checkLastSat`) and their sit-count is more than 1 below `max-sit`, mark them `"Holding"` instead and advance to the next candidate — i.e. don't let someone who just played *and* hasn't banked enough sits skip the queue.
   - Assign chosen player into the slot (`num<team>-<n>` = player id, `team<team>-<n>` = name), set their `play` status to `"Team N (White/Dark)"`, persist via `savePlayer`.
   - Whenever the pool is exhausted mid-fill, escalate to the next pool tier (`shuffleSittingPlayers()`), resetting the cursor.
5. Increment `rounds` (unless `keepteams`).
6. **Sitting list rebuild**: every player whose `play` status doesn't contain `"Team"` is written into the next sitting slot; if not `keepteams`, their sit-count is incremented and `round` stamped to the current round (this is what actually counts a "sit"). Tracks the running max sit count into `max-sit`.
7. `setLastSat()` snapshots the current sitting list into `last1..last10` (used by `checkLastSat` next round).
8. Persist everything; flips UI from "Set Teams" panel to "Game Updates" panel.

### `checkLastSat(playerNum)`
True if the player appears in `last1..last10` (sat last round), **or** if `rounds - player.round <= 2` (sat within the last 2 rounds) — both are used as "protect this player from sitting again immediately" signals.

### `reshuffleTeams()`
Resets Court-1 win streak, calls `assignTeams(1)` — re-scrambles current on-court players into new team slots without touching who's sitting or incrementing rounds.

---

## 4. Winner / rotation logic ("winner stays on")

### `updateWins()` (Submit Winners button)
1. Requires a round in progress and a winner selected for every active court.
2. `setNextPlayers()`: any player currently `Next`/`Sitting` gets promoted based on sit count vs `max-sit` (flips between `"Sitting"` and `"Next"` — essentially recomputes who's due up).
3. **Court 1 win-streak tracking**: if this round's Court 1 winner == previous winner, increment `court1-wins`; else reset to 1. If `court1-wins >= max-wins` (default 2), force a swap of the declared "winner" for rotation purposes and alert "Consecutive Games Reached, Winning Team will Sit" (i.e. the streaking team is benched even though they won); else persist `court1-winner`.
4. Sanity check: if Court 1 has fewer than 5 slots and the "up-and-coming" slot from Court 2 is already occupied, alert to reshuffle instead of proceeding (avoids overwrite).
5. **Losing team on Court 1** vacates its slots; each of those players' status flips to `"Holding"` (if under `max-sit`) or `"Pending"` (if already at/above `max-sit` — i.e. more eligible to actually sit now).
6. **`moveTeam(winnerTeam, targetCourt)`** for Court 2/3/4 if active: winner of Court 2 moves up into Court 1's now-open loser slot (`workup` = 1 or 2 depending which Court-1 team lost); winner of Court 3 moves into Court 2 (target 3); winner of Court 4 moves into Court 3 (target 4). Each moved-up court's own loser side is vacated the same way (Holding/Pending per sit count).
7. Resets the winner-select dropdowns; calls `assignTeams(0)` to refill all now-open slots from the shuffle pools and increment the round.

### `moveTeam(from, to)`
Copies team `from`'s 5 slots into team `to`'s slots (num + name), clears `from`'s slots, and updates each moved player's `play` status to `"Team <to>"`.

---

## 5. Manual overrides

### `sitPlayer()`
Manually bench a player by number: clears them from any team slot, sets `play`="Sitting", stamps `round`, increments their `sit` count, saves.

### `swapPlayers()`
Swap two players by number (works whether they're on a team or sitting): exchanges their `play`/`sit`/`round` status appropriately (adjusting sit counters if either was sitting/next in the *current* round only), and finds+swaps their slot in whichever team-slot or sitting-slot table currently references them.

### `clearTeams()`
Blank all team slots and the sitting list; sets every player's `play` back to `"None"`; shows the "Set Teams" panel again; resets Court-1 win streak.

### `clearSat()`
Reset `max-sit` to 1, `rounds` to 0, and every player's `sit`/`round` to 0 — a fresh-fairness reset without removing players or teams.

### `updateRound()`
Manually bumps `rounds` by 1 (independent escape hatch, e.g. if games are being tracked outside the auto-flow).

---

## Data model suggestion for the port

```
Player { id, name, status: 'none'|'team'|'sitting'|'next'|'holding'|'pending', teamId?, sitCount, lastRoundActive }
Team   { id, courtId, side: 'white'|'dark', playerIds: [] }
Court  { id, teamAId, teamBId, sizePerTeam, active }
GameState {
  players: Player[],
  courts: Court[],       // 1-4, derived sizes from distributePlayers table
  round: number,
  maxSit: number,        // fairness threshold
  maxConsecutiveWins: number,  // default 2
  gameType: 2|3|4|5,     // minimum game format
  numCourts: 1-4,
  court1Winner?: teamId,
  court1WinStreak: number,
  lastSatPlayerIds: number[],  // last round's sitters (replaces last1..last10)
}
```

Key behaviors to preserve: the **fairness-first shuffle cascade** (prefer most-sat-out players, escalate pool only when needed), the **"holding" grace period** (don't replay someone who just sat unless nobody else is eligible), the **winner-stays-with-streak-cap** rotation across courts, and the **contiguous player renumbering** on removal (or better: switch to stable UUIDs instead of positional IDs, which removes the need for the renumbering logic entirely — an easy real win when porting away from the DOM-ID-keyed original).
