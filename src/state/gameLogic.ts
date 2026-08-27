// All of the app's business logic lives in this one file, on purpose - see
// OPEN_GYM_LOGIC.md for the original single-file app this replaces. Every
// function here is a pure `(state, ...args) => state` transform: no React,
// no DOM, fully testable on its own (see gameLogic.test.ts). reducer.ts is
// a thin dispatcher that calls into this file and turns thrown errors into
// state.lastError for the UI to show as a toast (replacing the original's
// alert() popups).
//
// Sections (in the order a new round of the game actually happens):
//   1. Roster management        - add/remove players                    [M1]
//   2. Court distribution        - how many players per team, per court  [M2]
//   3. Shuffle cascade            - who plays next, fairly               [M2]
//   4. Assign teams                - fill empty team slots               [M2]
//   5. Winner-stays rotation        - handle "who won", advance the round [M3]
//   6. Manual player movement        - drag-and-drop bench <-> team slots [M4]

import type { Court, DropTarget, GameState, GameType, Player, PlayerStatus, Team } from '../types';
import { createId } from './id';

// ---- 1. Roster management ----
// Replaces the original's addPlayer()/RemovePlayer(). The original kept
// players in 50 fixed DOM rows and had to shift every later player's number
// down by one whenever someone was removed. Because players here have a
// stable `id` instead of a position, removal needs no renumbering at all.

const MAX_PLAYERS = 50;

/** Adds a new player to the roster. Mirrors the original's addPlayer(). */
export function addPlayer(state: GameState, rawName: string): GameState {
  const name = rawName.trim();

  if (name.length < 2) {
    throw new Error('Player name must be at least 2 characters.');
  }
  if (state.players.length >= MAX_PLAYERS) {
    throw new Error(`Max is ${MAX_PLAYERS} players.`);
  }
  // Original does a case-sensitive exact-match duplicate check; kept as-is
  // rather than "improving" to case-insensitive, since that's a real behavior
  // change someone might be relying on (e.g. distinguishing "Josh" vs "josh").
  if (state.players.some((p) => p.name === name)) {
    throw new Error('Name already exists, need unique names, try adding a first initial.');
  }

  const newPlayer: Player = {
    id: createId(),
    name,
    status: 'none',
    teamId: null,
    // If a round is already underway, a brand-new player starts having
    // "sat" once already, so they don't unfairly jump straight onto a team
    // ahead of people who've actually been waiting. Mirrors the original's
    // `sit = rounds > 0 ? 1 : 0`.
    sitCount: state.round > 0 ? 1 : 0,
    statusRound: state.round,
  };

  return { ...state, players: [...state.players, newPlayer] };
}

/**
 * Removes a player from the roster.
 *
 * This just clears the player out of whatever team slot they occupied - it
 * does not auto-replace them the way the original's RemovePlayer() did
 * (pulling the next fair candidate off the bench mid-round). Re-running
 * "Assign Teams" after a removal fills the gap using the same fairness
 * rules, so the behavior is equivalent with one extra click instead of a
 * separate replacement code path.
 */
export function removePlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const teams = { ...state.teams };
  if (player.teamId && teams[player.teamId]) {
    const team = teams[player.teamId];
    teams[player.teamId] = {
      ...team,
      slots: team.slots.map((s) => (s === playerId ? null : s)),
    };
  }

  return {
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
    teams,
    sittingOrder: state.sittingOrder.filter((id) => id !== playerId),
    lastSatPlayerIds: state.lastSatPlayerIds.filter((id) => id !== playerId),
  };
}

/** Wipes every player and resets settings back to defaults. Mirrors the
 * original's resetAll(). */
export function resetAll(state: GameState): GameState {
  const teams = { ...state.teams };
  for (const id of Object.keys(teams)) {
    teams[id] = { ...teams[id], slots: teams[id].slots.map(() => null) };
  }
  return {
    ...state,
    players: [],
    teams,
    sittingOrder: [],
    lastSatPlayerIds: [],
    round: 0,
    maxSit: 1,
    court1WinnerTeamId: null,
    court1WinStreak: 0,
    lastError: null,
  };
}

// ---- 2. Court distribution ----
// Replaces the original's distributePlayers(). Given how many courts are in
// use, how many players there are, and the "Minimum Game" setting, decides
// how many players-per-team each court should run.
//
// This is a faithful port of the original's per-band if-chains (see
// OPEN_GYM_LOGIC.md), with one boundary fix: the gameType===4 band for 18-19
// players used `players > 18` while every other boundary in this table uses
// `>= `, which meant exactly 18 players fell through to no band at all and
// Court 2 stayed off. That's inconsistent with the rest of the table and
// almost certainly a typo, so it's written here as `>= 18` - flagging this
// in case the original behavior was actually intentional.

export interface CourtSizes {
  court1: number;
  court2: number;
  court3: number;
  court4: number;
}

function soloCourtSize(players: number): number {
  // Single-court default is a full 5v5; shrinks only if there aren't enough
  // players for that.
  if (players >= 8 && players < 10) return 4;
  if (players >= 6 && players < 8) return 3;
  return 5;
}

// Court 1 and Court 2 sizes once Court 2 is actually warranted (see the
// maxSingleCourtPlayers gate in distributePlayers) - below that gate,
// staying on a single fuller court beats splitting into two smaller ones
// (e.g. two 3v3s), so Court 2 stays off entirely and Court 1 just uses the
// same single-court sizing as if only 1 court existed. Court 1 defaults to
// a full 5v5 within this table and only shrinks when a band below says so.
//
// The 12-13 -> (3,3) band for gameType 3 only ever fires if
// maxSingleCourtPlayers has been lowered below its default of 13 (its
// default gate means players < 14 never reach this function at all) - it
// exists so lowering that setting to 12 actually does something, since 12
// is the true minimum for two valid 3v3 courts (2 courts x 3v3 x 2 teams).
// Lowering the setting further, to 4-11, has no additional effect: there
// still aren't enough players for two valid games at any gameType's
// minimum, so Court 1 stays solo regardless of the gate.
function twoCourtSizes(gameType: GameType, players: number): { court1: number; court2: number } {
  let court1 = 5;
  let court2 = 0;

  switch (gameType) {
    case 2: // 2v2 minimum
      if (players >= 14 && players < 16) { court1 = 5; court2 = 2; }
      if (players >= 16 && players < 18) { court1 = 4; court2 = 4; }
      if (players >= 18 && players < 20) { court1 = 5; court2 = 4; }
      if (players >= 20) { court1 = 5; court2 = 5; }
      break;
    case 4: // 4v4 minimum
      if (players >= 16 && players < 18) { court1 = 4; court2 = 4; }
      if (players >= 18 && players < 20) { court2 = 4; }
      if (players >= 20) { court2 = 5; }
      break;
    case 5: // 5v5 minimum - Court 2 only opens once there's enough for a full 5v5 team
      if (players >= 20) { court2 = 5; }
      break;
    case 3: // 3v3 minimum (default)
    default:
      if (players >= 12 && players < 14) { court1 = 3; court2 = 3; }
      if (players >= 14 && players < 16) { court1 = 4; court2 = 3; }
      if (players >= 16 && players < 18) { court1 = 4; court2 = 4; }
      if (players >= 18 && players < 20) { court1 = 5; court2 = 4; }
      if (players >= 20) { court1 = 5; court2 = 5; }
      break;
  }

  return { court1, court2 };
}

function thirdCourtSize(players: number): number {
  if (players > 29) return 5;
  if (players > 27) return 4;
  if (players > 25) return 3;
  return 0;
}

function fourthCourtSize(players: number): number {
  if (players > 39) return 5;
  if (players > 37) return 4;
  if (players > 35) return 3;
  return 0;
}

/**
 * Computes players-per-team for each of the 4 courts.
 *
 * `maxSingleCourtPlayers` (new, non-original setting, default 13): Court 2
 * stays off - everyone plays a single, fuller game on Court 1 - until the
 * player count exceeds this. Splitting into two smaller games (e.g. two
 * 3v3s at 12 players) is worse than one bigger one (5v5, with a few
 * sitting) below that point. See twoCourtSizes for how this interacts with
 * Minimum Game's own floor.
 *
 * `maxTeamSize` is the new (non-original) cap: after the bands above pick
 * the "maximize simultaneous players" size for each active court, clamp it
 * down to the cap and let the overflow sit instead of forcing a bigger game.
 * Example: 18 players, 2 courts, gameType=3 (3v3 minimum), maxTeamSize=4 ->
 * uncapped gives (5, 4) [everyone plays], capped gives (4, 4) [2 sit].
 */
export function distributePlayers(
  numCourts: 1 | 2 | 3 | 4,
  players: number,
  gameType: GameType,
  maxTeamSize: GameType | null,
  maxSingleCourtPlayers: number,
): CourtSizes {
  // Court 1 always starts from single-court sizing (full 5v5, shrinking
  // only for small groups - see soloCourtSize). Court 2 only overrides
  // this once there are enough players to be worth splitting for.
  const sizes: CourtSizes = { court1: soloCourtSize(players), court2: 0, court3: 0, court4: 0 };

  if (numCourts >= 2 && players > maxSingleCourtPlayers) {
    const two = twoCourtSizes(gameType, players);
    sizes.court1 = two.court1;
    sizes.court2 = two.court2;
  }

  if (numCourts >= 3) sizes.court3 = thirdCourtSize(players);
  if (numCourts >= 4) sizes.court4 = fourthCourtSize(players);

  if (maxTeamSize != null) {
    sizes.court1 = Math.min(sizes.court1, maxTeamSize);
    sizes.court2 = Math.min(sizes.court2, maxTeamSize);
    sizes.court3 = Math.min(sizes.court3, maxTeamSize);
    sizes.court4 = Math.min(sizes.court4, maxTeamSize);
  }

  return sizes;
}

/**
 * Guardrail check offered on "Assign Teams": with a single, mostly-full
 * court (bench smaller than a full team) and a high Winner Stays On cap, the
 * losing side's revolving door can't be fully refilled from the bench alone
 * - some just-benched player is always recycled straight back in. A long win
 * streak compounds that recycling round after round until someone sits
 * twice before the protected winning team has sat even once. This doesn't
 * fire for multi-court setups or a big-enough bench, since the bench alone
 * can cover a full team swap there and the tension doesn't come up.
 */
export function isRiskyStreakSetup(state: GameState): boolean {
  if (state.numCourts !== 1 || state.maxConsecutiveWins <= 2) return false;
  const sizes = distributePlayers(
    state.numCourts,
    state.players.length,
    state.gameType,
    state.maxTeamSize,
    state.maxSingleCourtPlayers,
  );
  const bench = state.players.length - sizes.court1 * 2;
  return bench > 0 && bench < sizes.court1;
}

/** Recomputes court sizes/active flags from the current roster and settings. */
function applyDistribution(state: GameState): GameState {
  const sizes = distributePlayers(
    state.numCourts,
    state.players.length,
    state.gameType,
    state.maxTeamSize,
    state.maxSingleCourtPlayers,
  );
  const sizeByIndex: Record<1 | 2 | 3 | 4, number> = {
    1: sizes.court1,
    2: sizes.court2,
    3: sizes.court3,
    4: sizes.court4,
  };
  const courts: Court[] = state.courts.map((c) => {
    const sizePerTeam = sizeByIndex[c.index];
    return { ...c, sizePerTeam, active: c.index <= state.numCourts && sizePerTeam > 0 };
  });
  return { ...state, courts };
}

// ---- 3. Shuffle cascade ----
// Replaces the original's shuffleTeamPlayers()/shuffleNextPlayers()/
// shuffleSittingPlayers()/shufflePendingPlayers()/shuffleRemainingPlayers()
// chain. Each of those was a progressively wider pool of "who's allowed to
// play next", tried in order until one had candidates. Instead of the
// original's global mutable array + lazy re-fill-on-exhaustion, this builds
// one flat, priority-ordered list up front: first everyone from the
// narrowest eligible tier, then whoever the next tier adds that the first
// tier didn't already include, and so on. Reading through that list in
// order is equivalent to the original's "try this pool, fall back to the
// next one when it runs dry" behavior, just without having to re-derive the
// fallback pool mid-loop. Within each tier, players are ordered by sit-count
// (most-sat-out first, see orderByFairness) rather than pure chance -
// randomness only ever breaks a genuine tie between equally-due players.

export function fisherYatesShuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Orders players within one eligibility tier by how many rounds they've
 * sat out, most first - so "who actually gets pulled off the bench first"
 * is decided by sit-count whenever it differs, not left to chance. Within
 * a fallback tier (see buildCandidateOrder) sit-counts can genuinely
 * differ - e.g. someone who's sat 3 times can end up in the same wider
 * pool as someone just vacated from a losing team who's sat 0 times - and
 * shuffling them together would let the person who's sat less get picked
 * ahead of someone who's clearly more due, purely by luck.
 *
 * Players with the *same* sit-count are shuffled against each other, not
 * ranked further: they became eligible from the same event (e.g. an entire
 * losing team benched together) and are genuinely equally deserving right
 * now - there's no fairness signal left to break that tie with. Whoever
 * loses that shuffle isn't actually worse off for long, though: they stay
 * on the bench, their sit-count ticks up past the others' next round, and
 * that makes them the clear next pick - the same rough correction a
 * human game manager would make by remembering "I sat them last time."
 */
function orderByFairness(players: Player[], rng: () => number = Math.random): Player[] {
  const bySitCount = new Map<number, Player[]>();
  for (const p of players) {
    const group = bySitCount.get(p.sitCount);
    if (group) group.push(p);
    else bySitCount.set(p.sitCount, [p]);
  }
  const descendingSitCounts = [...bySitCount.keys()].sort((a, b) => b - a);
  return descendingSitCounts.flatMap((count) => fisherYatesShuffle(bySitCount.get(count)!, rng));
}

const BENCH_STATUSES: PlayerStatus[] = ['sitting', 'none'];

// The narrowest tier for a *new* game: players who are actually "due" to
// play, i.e. they've sat out at least as many rounds as the current fairness
// bar (maxSit). Everyone else on the bench is left alone for now (they'll be
// picked up by the wider fallback tiers below only if there aren't enough
// due players to fill every slot).
function buildDueTierPool(state: GameState): Player[] {
  const eligible = state.players.filter(
    (p) => BENCH_STATUSES.includes(p.status) && (state.round < 1 || p.sitCount >= state.maxSit),
  );
  if (state.round >= 1) return eligible;

  // Very first game of the day: nobody has sat yet, so instead of "who's
  // due" (everyone, vacuously), prioritize whoever was added first - see the
  // app's own "First Game prioritizes based on order added" note. Limiting
  // the pool to exactly the number of open slots means the earliest joiners
  // fill the first game and everyone after starts on the bench.
  const capacity = getActiveCourts(state).reduce((sum, c) => sum + c.sizePerTeam * 2, 0);
  const firstInLine = new Set(state.players.slice(0, capacity).map((p) => p.id));
  return eligible.filter((p) => firstInLine.has(p.id));
}

/** Builds the full priority-ordered candidate list for filling team slots.
 * `keepTeams` selects the narrower "just reshuffle who's already playing"
 * pool used by Reshuffle Teams, instead of pulling fresh players off the
 * bench. */
function buildCandidateOrder(state: GameState, keepTeams: boolean): Player[] {
  const tierPools: Player[][] = keepTeams
    ? [state.players.filter((p) => p.status === 'team')]
    : [
        buildDueTierPool(state),
        state.players.filter((p) => BENCH_STATUSES.includes(p.status)),
        state.players.filter((p) => BENCH_STATUSES.includes(p.status) || p.status === 'pending'),
        state.players.filter((p) => p.status !== 'team'),
      ];

  const seen = new Set<string>();
  const ordered: Player[] = [];
  for (const pool of tierPools) {
    const fresh = pool.filter((p) => !seen.has(p.id));
    for (const p of orderByFairness(fresh)) {
      seen.add(p.id);
      ordered.push(p);
    }
  }
  return ordered;
}

/** A one-shot, already-shuffled queue of "who plays next" for a single
 * Assign Teams pass. Call `.next()` to draw the next candidate. */
function createCandidateFeed(state: GameState, keepTeams: boolean) {
  const ordered = buildCandidateOrder(state, keepTeams);
  let cursor = 0;
  return {
    next(): Player | undefined {
      return cursor < ordered.length ? ordered[cursor++] : undefined;
    },
  };
}

// ---- 4. Assign teams ----
// Replaces the original's assignTeams()/reshuffleTeams()/checkLastSat().

/** True if this player sat out last round, or has sat within the last 2
 * rounds - both are used as "don't bench them again immediately" signals. */
export function checkLastSat(state: GameState, playerId: string): boolean {
  if (state.lastSatPlayerIds.includes(playerId)) return true;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  return state.round - player.statusRound <= 2;
}

export function getActiveCourts(state: GameState): Court[] {
  return state.courts.filter((c) => c.active);
}

function setPlayerStatus(state: GameState, playerId: string, status: PlayerStatus): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, status } : p)),
  };
}

function placePlayerOnTeam(state: GameState, playerId: string, teamId: string, slotIndex: number): GameState {
  const team = state.teams[teamId];
  const slots = [...team.slots];
  slots[slotIndex] = playerId;
  return {
    ...state,
    teams: { ...state.teams, [teamId]: { ...team, slots } },
    players: state.players.map((p) => (p.id === playerId ? { ...p, teamId, status: 'team' } : p)),
  };
}

// Team fill order matches the original: Team 1, Team 2 (Court 1), then Team
// 3, Team 4 (Court 2), etc. - Court 1 always fills first since it's the
// "main" court.
const TEAM_COURT_ORDER: { teamId: string; courtIndex: 1 | 2 | 3 | 4 }[] = [
  { teamId: 'team-1', courtIndex: 1 },
  { teamId: 'team-2', courtIndex: 1 },
  { teamId: 'team-3', courtIndex: 2 },
  { teamId: 'team-4', courtIndex: 2 },
  { teamId: 'team-5', courtIndex: 3 },
  { teamId: 'team-6', courtIndex: 3 },
  { teamId: 'team-7', courtIndex: 4 },
  { teamId: 'team-8', courtIndex: 4 },
];

/**
 * Removes the excess players from any team that's grown too big for its
 * *current* size, and un-marks whoever was removed. Needed because a team
 * can shrink between assignments (a new, smaller Max Team Size cap, or a
 * settings change) while still holding more players than now fit - e.g. a
 * 5v5 team capped down to 4v4 still has a 5th player. CourtView only ever
 * renders slots up to the current size, so that player would silently
 * disappear from the court - and since nothing else touches their `status`,
 * it'd still say 'team', so the bench-rebuild sweep below (which only
 * benches players *not* marked 'team') would skip them too. They'd be
 * stuck: not shown on the court, not shown on the bench.
 *
 * Which player(s) get removed matters for fairness: picking by raw slot
 * index (i.e. always cutting whichever slot happens to be last) is a trap -
 * when a cap is lifted, the fill loop naturally slots previously-benched
 * players into whatever slot just opened up (usually the last one), so if
 * the cap comes back later, index-based truncation would immediately bench
 * the very players who had just been fairly rotated in, undoing that
 * rotation. Instead, remove whoever on the oversized team has the *lowest*
 * sitCount - they've had relatively more playing time already, so they're
 * the fairest pick to give up their spot.
 *
 * Called before anything else in assignTeams so both the fill loop and the
 * keepTeams candidate pool see the corrected state.
 */
function truncateOversizedTeams(state: GameState): GameState {
  let next = state;
  for (const court of next.courts) {
    for (const teamId of [court.teamAId, court.teamBId]) {
      const team = next.teams[teamId];
      const filled = team.slots.filter((id): id is string => id !== null);
      if (filled.length <= court.sizePerTeam) continue;

      // Keep the highest-sitCount players (they've earned their spot back
      // most recently); the rest go to the bench.
      const keepIds = filled
        .map((id) => next.players.find((p) => p.id === id)!)
        .sort((a, b) => b.sitCount - a.sitCount)
        .slice(0, court.sizePerTeam)
        .map((p) => p.id);
      const keepSet = new Set(keepIds);
      const removedIds = filled.filter((id) => !keepSet.has(id));

      // Rebuild the slots array so the keepers occupy the low, in-range
      // indices with no gaps - if we instead just nulled out the removed
      // player's *own* slot, a kept player could end up stranded at a now
      // out-of-range index whenever the removed player happened to have
      // been in a lower slot than them, reproducing the exact "phantom
      // player" bug this function exists to prevent, just one step later.
      const slots = team.slots.map(() => null as string | null);
      keepIds.forEach((id, i) => {
        slots[i] = id;
      });

      next = {
        ...next,
        teams: { ...next.teams, [teamId]: { ...team, slots } },
        players: next.players.map((p) => (removedIds.includes(p.id) ? { ...p, status: 'holding', teamId: null } : p)),
      };
    }
  }
  return next;
}

/**
 * Fills every empty team slot on every active court, then rebuilds the
 * bench. This is the single entry point both the "Assign Teams" button
 * (keepTeams=false) and "Reshuffle Teams" (keepTeams=true) call.
 *
 * Only *empty* slots get filled - if a team already has players in it (e.g.
 * a team that just won and is staying on Court 1), those slots are left
 * alone. That's how "winner stays on" actually works: updateWins() (section
 * 5) only clears the losing teams' slots before calling this.
 */
export function assignTeams(state: GameState, keepTeams: boolean): GameState {
  if (state.players.length < 6) {
    throw new Error('Minimum 6 players required.');
  }

  let next = truncateOversizedTeams(applyDistribution(state));

  if (keepTeams) {
    // Reshuffle: capture who's currently playing before wiping the board, so
    // the fill loop below redistributes exactly those same players.
    const teams = { ...next.teams };
    for (const id of Object.keys(teams)) {
      teams[id] = { ...teams[id], slots: teams[id].slots.map(() => null) };
    }
    next = { ...next, teams, court1WinnerTeamId: null, court1WinStreak: 0 };
  }

  const feed = createCandidateFeed(next, keepTeams);

  for (const { teamId, courtIndex } of TEAM_COURT_ORDER) {
    const court = next.courts.find((c) => c.index === courtIndex)!;
    if (!court.active) continue;

    for (let slotIndex = 0; slotIndex < court.sizePerTeam; slotIndex++) {
      if (next.teams[teamId].slots[slotIndex] !== null) continue; // already filled (e.g. winner staying on)

      let candidate = feed.next();

      // Fairness grace period: if this candidate didn't sit last round *and*
      // still has plenty of room before they're "due" (more than 1 round
      // below the fairness bar), skip them once in favor of the very next
      // candidate in line - mirrors the original exactly, including that it
      // only re-checks the replacement's own eligibility on a later slot,
      // not immediately.
      if (
        candidate &&
        next.round > 0 &&
        !checkLastSat(next, candidate.id) &&
        next.maxSit - candidate.sitCount > 1
      ) {
        next = setPlayerStatus(next, candidate.id, 'holding');
        candidate = feed.next();
      }

      if (!candidate) break; // nobody left to place; leave remaining slots open
      next = placePlayerOnTeam(next, candidate.id, teamId, slotIndex);
    }
  }

  if (!keepTeams) {
    next = { ...next, round: next.round + 1 };
  }

  // Rebuild the bench: anyone not on a team now is sitting, in roster order
  // (matches the original's row-by-row sitting-list rebuild).
  let maxSit = next.maxSit;
  const sittingOrder: string[] = [];
  const players = next.players.map((p) => {
    if (p.status === 'team') return p;
    sittingOrder.push(p.id);
    if (keepTeams) return { ...p, status: 'sitting' as const };

    const sitCount = p.sitCount + 1;
    if (sitCount > maxSit) maxSit = sitCount;
    return { ...p, status: 'sitting' as const, sitCount, statusRound: next.round };
  });

  return {
    ...next,
    players,
    sittingOrder,
    maxSit,
    lastSatPlayerIds: sittingOrder.slice(0, 10),
    lastError: null,
  };
}

/** Reshuffles who's on which team without touching who's sitting or
 * advancing the round. Mirrors the original's reshuffleTeams(). */
export function reshuffleTeams(state: GameState): GameState {
  return assignTeams(state, true);
}

// ---- 5. Winner-stays rotation ----
// Replaces the original's updateWins()/moveTeam(). "Winner stays on" cascades
// up through the courts: Court 1's loser benches and Court 2's winner moves
// into their spot. Court 2 is then completely empty, so BOTH Court 3's
// winner and Court 4's winner move up into it (Court 3's winner takes
// team-3, Court 4's winner takes team-4) - Court 3 and Court 4 always end
// each round fully empty and get refilled straight from the bench by the
// assignTeams() call at the end. This mirrors the original, including fixing
// two apparent copy-paste bugs in its Court 3/4 loser-vacate code (it reused
// variables named lost2num/lost2name instead of lost3num/lost4num, and its
// Court 4 branch checked `win3` instead of `win4`) - flagging these in case
// the original behavior was actually intentional rather than a typo.
//
// The original also had a setNextPlayers() step that relabeled bench players
// as "Sitting" vs "Next" before refilling. That distinction doesn't actually
// change who gets picked anywhere else in the app (both statuses are treated
// identically by the fairness/candidate logic), so it's a cosmetic label
// with no behavioral effect - skipped here rather than ported as dead
// complexity. A "who's up next" indicator can be added later as a pure
// selector over sitCount instead of a stored status (see M5 polish).

function moveTeam(state: GameState, fromTeamId: string, toTeamId: string): GameState {
  const fromTeam = state.teams[fromTeamId];
  const toTeam = state.teams[toTeamId];
  const movedIds = fromTeam.slots.filter((id): id is string => id !== null);
  return {
    ...state,
    teams: {
      ...state.teams,
      [fromTeamId]: { ...fromTeam, slots: fromTeam.slots.map(() => null) },
      [toTeamId]: { ...toTeam, slots: [...fromTeam.slots] },
    },
    players: state.players.map((p) => (movedIds.includes(p.id) ? { ...p, teamId: toTeamId } : p)),
  };
}

/** Clears a team's slots and benches whoever was on it - holding briefly
 * unless they've already sat enough rounds to be fully due again. */
function vacateTeam(state: GameState, teamId: string): GameState {
  const team = state.teams[teamId];
  const playerIds = team.slots.filter((id): id is string => id !== null);
  return {
    ...state,
    players: state.players.map((p) => {
      if (!playerIds.includes(p.id)) return p;
      const status: PlayerStatus = p.sitCount < state.maxSit ? 'holding' : 'pending';
      return { ...p, status, teamId: null };
    }),
    teams: { ...state.teams, [teamId]: { ...team, slots: team.slots.map(() => null) } },
  };
}

function otherTeamOnCourt(court: Court, teamId: string): string {
  return teamId === court.teamAId ? court.teamBId : court.teamAId;
}

/**
 * Records who won each active court, advances "winner stays on" (with a
 * consecutive-win cap on Court 1 - see maxConsecutiveWins), cascades winners
 * up through the courts, and refills every now-open slot from the bench.
 * `winners` maps courtId -> the winning teamId.
 */
export function updateWins(state: GameState, winners: Record<string, string>): GameState {
  // Checking team assignment directly, not `round === 0`: Clear # Games Sat
  // resets the round counter without touching who's on a team, so relying
  // on round alone let the UI keep showing Submit Winners (it already
  // checks assignment, not round - see RotationBoard.tsx) right up until
  // this guard threw "Assign Teams first" on a team that very much existed.
  if (!state.players.some((p) => p.status === 'team')) {
    throw new Error('No teams yet - Assign Teams first.');
  }
  const activeCourts = getActiveCourts(state);
  for (const court of activeCourts) {
    if (!winners[court.id]) {
      throw new Error(`Select a winner for Court ${court.index}.`);
    }
  }

  let next = state;

  const court1 = activeCourts.find((c) => c.index === 1)!;
  const declaredWinnerId = winners[court1.id];
  const streak = declaredWinnerId === next.court1WinnerTeamId ? next.court1WinStreak + 1 : 1;

  const capHit = streak >= next.maxConsecutiveWins;
  const court1WinnerTeamIdToStore = capHit ? null : declaredWinnerId;
  const court1WinStreak = capHit ? 0 : streak;
  next = { ...next, court1WinnerTeamId: court1WinnerTeamIdToStore, court1WinStreak };

  const court1LoserId = otherTeamOnCourt(court1, declaredWinnerId);
  next = vacateTeam(next, court1LoserId);
  if (capHit) {
    // Streak cap hit: don't just swap which side "stays" (that used to
    // vacate the actual winner's slots and leave the actual loser's
    // untouched, which produced a real rotation only when the bench had
    // enough spare players to fully replace one team - with a small bench,
    // e.g. 11 players/1 spare, only one seat had anywhere else to go, so it
    // looked like nothing changed). Instead, vacate the winner's slots too,
    // pooling all 10 currently-playing Court 1 players together with the
    // bench - the fill loop below (still highest-sitCount-first) decides
    // who's actually due to keep playing, and Court 1 reforms as two fresh
    // teams from whoever that is, not "the same team minus one player."
    next = vacateTeam(next, declaredWinnerId);
  }

  const court2 = activeCourts.find((c) => c.index === 2);
  if (court2) {
    const court2WinnerId = winners[court2.id];
    const court2LoserId = otherTeamOnCourt(court2, court2WinnerId);
    next = moveTeam(next, court2WinnerId, court1LoserId);
    next = vacateTeam(next, court2LoserId);
  }

  // Court 2 is now fully empty (its winner moved up, its loser just
  // vacated) - Court 3 and Court 4's winners both feed into it.
  const court3 = activeCourts.find((c) => c.index === 3);
  if (court3) {
    const court3WinnerId = winners[court3.id];
    const court3LoserId = otherTeamOnCourt(court3, court3WinnerId);
    next = moveTeam(next, court3WinnerId, 'team-3');
    next = vacateTeam(next, court3LoserId);
  }

  const court4 = activeCourts.find((c) => c.index === 4);
  if (court4) {
    const court4WinnerId = winners[court4.id];
    const court4LoserId = otherTeamOnCourt(court4, court4WinnerId);
    next = moveTeam(next, court4WinnerId, 'team-4');
    next = vacateTeam(next, court4LoserId);
  }

  return assignTeams(next, false);
}

// ---- Manual overrides ----
// Replaces the original's sitPlayer()/swapPlayers(). No dedicated UI calls
// these directly anymore - dragging a player card (movePlayer, section 6)
// covers both cases - but movePlayer's team-slot-to-bench and
// swap-onto-an-occupied-slot cases build on top of these two functions.

/** Manually benches a player who's currently on a team. */
export function sitPlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found.');
  if (player.status !== 'team') {
    throw new Error(`${player.name} is not currently on a team.`);
  }

  const teams = { ...state.teams };
  if (player.teamId) {
    const team = teams[player.teamId];
    teams[player.teamId] = { ...team, slots: team.slots.map((s) => (s === playerId ? null : s)) };
  }

  const sitCount = player.sitCount + 1;
  return {
    ...state,
    teams,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, status: 'sitting', teamId: null, sitCount, statusRound: state.round }
        : p,
    ),
    sittingOrder: [...state.sittingOrder, playerId],
    maxSit: Math.max(state.maxSit, sitCount),
    lastError: null,
  };
}

/**
 * If a swap crosses the team/bench boundary for one of the two players (the
 * common case: dragging a bench player onto an occupied team slot), applies
 * the same bench accounting as sitPlayer()/placeFromBench() - otherwise a
 * player benched via a swap would never get a sit counted against them
 * (breaking future fairness math), and a player swapped in right after
 * being benched this same round would wrongly keep that sit.
 * `self` is the player being evaluated; `newStatus` is the status they're
 * taking on post-swap (their swap partner's old status).
 */
function swapBenchAdjustment(
  self: Player,
  newStatus: PlayerStatus,
  round: number,
): Pick<Player, 'sitCount' | 'statusRound'> | null {
  if (self.status === 'team' && newStatus !== 'team') {
    // Heading to the bench.
    return { sitCount: self.sitCount + 1, statusRound: round };
  }
  if (self.status !== 'team' && newStatus === 'team') {
    // Heading onto a team - refund a same-round bench bump, if any.
    const sitBumpedThisRound = self.statusRound === round;
    return { sitCount: sitBumpedThisRound ? Math.max(0, self.sitCount - 1) : self.sitCount, statusRound: self.statusRound };
  }
  return null; // team<->team or bench<->bench: nobody's sit accounting changes
}

/** Swaps two players' spots, whatever those are - team slot <-> team slot,
 * team slot <-> bench, or bench <-> bench. Each player takes over the
 * other's status/team-slot/bench-position entirely. */
export function swapPlayers(state: GameState, playerAId: string, playerBId: string): GameState {
  if (playerAId === playerBId) return state;
  const a = state.players.find((p) => p.id === playerAId);
  const b = state.players.find((p) => p.id === playerBId);
  if (!a || !b) throw new Error('Player not found.');

  const teams = { ...state.teams };
  if (a.teamId) {
    const team = teams[a.teamId];
    teams[a.teamId] = { ...team, slots: team.slots.map((s) => (s === playerAId ? playerBId : s)) };
  }
  if (b.teamId) {
    const team = teams[b.teamId];
    teams[b.teamId] = { ...team, slots: team.slots.map((s) => (s === playerBId ? playerAId : s)) };
  }

  const sittingOrder = state.sittingOrder.map((id) => {
    if (id === playerAId) return playerBId;
    if (id === playerBId) return playerAId;
    return id;
  });

  const aAdjustment = swapBenchAdjustment(a, b.status, state.round);
  const bAdjustment = swapBenchAdjustment(b, a.status, state.round);

  const players = state.players.map((p) => {
    if (p.id === playerAId) return { ...p, status: b.status, teamId: b.teamId, ...aAdjustment };
    if (p.id === playerBId) return { ...p, status: a.status, teamId: a.teamId, ...bAdjustment };
    return p;
  });

  const maxSit = players.reduce((max, p) => Math.max(max, p.sitCount), state.maxSit);

  return { ...state, teams, players, sittingOrder, maxSit, lastError: null };
}

/** Blanks every team's slots and puts everyone back to 'none'/bench.
 * Mirrors the original's clearTeams(). */
export function clearTeams(state: GameState): GameState {
  const teams = { ...state.teams };
  for (const id of Object.keys(teams)) {
    teams[id] = { ...teams[id], slots: teams[id].slots.map(() => null) };
  }
  return {
    ...state,
    teams,
    court1WinnerTeamId: null,
    court1WinStreak: 0,
    sittingOrder: state.players.map((p) => p.id),
    players: state.players.map((p) => ({ ...p, status: 'none', teamId: null })),
    lastError: null,
  };
}

/** Resets the fairness counters (sit counts and round) without touching the
 * roster or teams. Mirrors the original's clearSat(). */
export function clearSat(state: GameState): GameState {
  return {
    ...state,
    maxSit: 1,
    round: 0,
    players: state.players.map((p) => ({ ...p, sitCount: 0, statusRound: 0 })),
    lastError: null,
  };
}

// ---- 6. Manual player movement (drag-and-drop) ----
// This is the new part - the original had no equivalent, just the number-
// entry sitPlayer()/swapPlayers() from the section above. `movePlayer` is
// the single function dnd-kit's onDragEnd calls (see RotationBoard.tsx):
// every drag - bench card onto a team slot, team card onto another slot,
// team card onto the bench - funnels through here, so all the "is this
// drop allowed and what does it do" logic lives in one place instead of
// being scattered across drag-handler callbacks.
//
// Drop outcomes:
//   bench      -> empty team slot   : place them, refund an accidental
//                                      same-round sit-count bump (see below)
//   bench      -> occupied team slot: swap - the occupant goes to the bench
//   team slot  -> bench             : sit them out (same as sitPlayer)
//   team slot  -> empty slot        : just relocate (same or different team)
//   team slot  -> occupied slot     : swap the two players in place
//   dropped on self                 : no-op
//
// "Can't drop onto a full team" needs no special-case code here: a full
// team simply has no empty slot for the UI to render as a drop target.

function relocateWithinTeams(state: GameState, playerId: string, toTeamId: string, toSlotIndex: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const teams = { ...state.teams };
  if (player.teamId) {
    const fromTeam = teams[player.teamId];
    teams[player.teamId] = { ...fromTeam, slots: fromTeam.slots.map((s) => (s === playerId ? null : s)) };
  }
  const toTeam = teams[toTeamId];
  const slots = [...toTeam.slots];
  slots[toSlotIndex] = playerId;
  teams[toTeamId] = { ...toTeam, slots };
  return {
    ...state,
    teams,
    players: state.players.map((p) => (p.id === playerId ? { ...p, teamId: toTeamId, status: 'team' } : p)),
  };
}

function placeFromBench(state: GameState, playerId: string, toTeamId: string, toSlotIndex: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const toTeam = state.teams[toTeamId];
  const slots = [...toTeam.slots];
  slots[toSlotIndex] = playerId;

  // If this player's sitCount was bumped for the round we're currently in
  // (i.e. assignTeams or sitPlayer just benched them this round), dragging
  // them onto a team means they're not actually sitting after all - refund
  // that one sit so it isn't double-counted against them later.
  const sitBumpedThisRound = player.statusRound === state.round;
  const sitCount = sitBumpedThisRound ? Math.max(0, player.sitCount - 1) : player.sitCount;

  return {
    ...state,
    teams: { ...state.teams, [toTeamId]: { ...toTeam, slots } },
    players: state.players.map((p) => (p.id === playerId ? { ...p, teamId: toTeamId, status: 'team', sitCount } : p)),
    sittingOrder: state.sittingOrder.filter((id) => id !== playerId),
  };
}

export function movePlayer(state: GameState, playerId: string, target: DropTarget): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found.');

  if (target.kind === 'bench') {
    if (player.status !== 'team') return state; // already on the bench
    return sitPlayer(state, playerId);
  }

  const team = state.teams[target.teamId];
  const occupantId = team.slots[target.slotIndex];
  if (occupantId === playerId) return state; // dropped on itself

  if (occupantId === null) {
    return player.status === 'team'
      ? relocateWithinTeams(state, playerId, target.teamId, target.slotIndex)
      : placeFromBench(state, playerId, target.teamId, target.slotIndex);
  }

  return swapPlayers(state, playerId, occupantId);
}

// ---- Selectors ----
// Small read helpers for components. Not worth a separate file at this size.

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function getTeam(state: GameState, teamId: string): Team | undefined {
  return state.teams[teamId];
}

/**
 * The live version of the isRiskyStreakSetup guardrail: has a fairness gap
 * actually happened just now? True when someone on the bench has sat 2+
 * times while some currently-playing player, on ANY active court, hasn't
 * sat even once. Deliberately not limited to Court 1's win-streak holder -
 * the same gap shows up whenever a player is effectively "protected" from
 * ever being reconsidered, which also happens to a team that cascades
 * winner-to-winner up through Courts 4->3->2->1 (no streak cap applies to
 * that climb, only to Court 1's own win-streak once a team gets there), or
 * after a manual drag-and-drop keeps someone on a team round after round.
 * Returns the specific pair a swap would fix (see the Auto-balance notice
 * in RotationBoard) so the caller doesn't have to re-derive who; null when
 * there's nothing to flag.
 */
export function findUnfairSecondSit(
  state: GameState,
): { repeatSitterId: string; neverSatPlayerId: string } | null {
  const neverSatPlaying = state.players.find((p) => p.status === 'team' && p.sitCount === 0);
  if (!neverSatPlaying) return null;

  const repeatSitter = state.sittingOrder
    .map((id) => getPlayer(state, id))
    .find((p): p is Player => !!p && p.sitCount >= 2);
  if (!repeatSitter) return null;

  return { repeatSitterId: repeatSitter.id, neverSatPlayerId: neverSatPlaying.id };
}
