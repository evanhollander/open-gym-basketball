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
//   3. Fairness ranking          - who's due to play next                [M2]
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
    court1WinnerTeamId: null,
    court1WinStreak: 0,
    lastError: null,
    lastNotice: null,
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

export function getActiveCourts(state: GameState): Court[] {
  return state.courts.filter((c) => c.active);
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
 *
 * This is a real risk under the current ranking model too, not just the
 * original: Court 1's winner is fully protected/deterministic (never
 * enters the fairness ranking) for as long as the streak continues, so
 * their sitCount can freeze for `maxConsecutiveWins - 1` rounds while a
 * small bench cycles - that's exactly the gap this catches.
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

/**
 * Detects when the roster has shrunk (or a sizing setting has changed)
 * enough since teams were last assigned that re-running Assign/Reshuffle
 * Teams would drop an active court entirely, rather than just resizing it
 * - e.g. losing 2 of 15 players can cross the `maxSingleCourtPlayers` gate
 * and turn off Court 2 completely, folding everyone into one bigger game
 * with no indication why. Returns null when nothing would shrink (including
 * the ordinary case of the very first Assign Teams of the day, when no
 * court is active yet to shrink from).
 */
export function courtShrinkWarning(state: GameState): { from: number; to: number } | null {
  const currentActive = getActiveCourts(state).length;
  if (currentActive === 0) return null;

  const sizes = distributePlayers(
    state.numCourts,
    state.players.length,
    state.gameType,
    state.maxTeamSize,
    state.maxSingleCourtPlayers,
  );
  const newActive = [sizes.court1, sizes.court2, sizes.court3, sizes.court4].filter((size) => size > 0).length;

  return newActive < currentActive ? { from: currentActive, to: newActive } : null;
}

// ---- 3. Fairness ranking ----
// Who plays next is decided by one global ranking, not a tiered fallback
// cascade: every player not already deterministically placed by the
// win-streak ladder (section 5) is ranked by how "due" they are, and
// whoever ranks highest fills however many slots are actually open.

export function fisherYatesShuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Orders `players` from most- to least-due to play: highest sitCount first
 * (most rounds sat out plays next); within a sitCount tie, whoever did
 * *not* sit last round (see lastSatPlayerIds) beats whoever did, so the
 * same person isn't benched two rounds running purely by chance; within
 * *that* tie, on the very first game of the day (round 0, so everyone's
 * tied at sitCount 0 and nobody's sat "last round" at all) whoever joined
 * the roster earliest wins - late arrivals don't get priority over people
 * who showed up on time. Any remaining genuine tie (every other round, or
 * a coincidental all-zero tie later in the day) is broken randomly, so a
 * group that's equally due doesn't always resolve the same way twice.
 */
function rankPlayersForRound(state: GameState, players: Player[], rng: () => number = Math.random): Player[] {
  const rosterIndex = new Map(state.players.map((p, i) => [p.id, i]));

  const bySitCount = new Map<number, Player[]>();
  for (const p of players) {
    const group = bySitCount.get(p.sitCount);
    if (group) group.push(p);
    else bySitCount.set(p.sitCount, [p]);
  }
  const descendingSitCounts = [...bySitCount.keys()].sort((a, b) => b - a);

  const orderSubgroup = (tier: Player[], sitCount: number): Player[] =>
    state.round === 0 && sitCount === 0
      ? [...tier].sort((a, b) => rosterIndex.get(a.id)! - rosterIndex.get(b.id)!)
      : fisherYatesShuffle(tier, rng);

  return descendingSitCounts.flatMap((count) => {
    const group = bySitCount.get(count)!;
    const notLastSat = group.filter((p) => !state.lastSatPlayerIds.includes(p.id));
    const didLastSat = group.filter((p) => state.lastSatPlayerIds.includes(p.id));
    return [...orderSubgroup(notLastSat, count), ...orderSubgroup(didLastSat, count)];
  });
}

// ---- 4. Assign teams ----
// Replaces the original's assignTeams()/reshuffleTeams().

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
        players: next.players.map((p) => (removedIds.includes(p.id) ? { ...p, status: 'sitting', teamId: null } : p)),
        // Matches sitPlayer()'s convention: anyone who becomes 'sitting'
        // must also be appended to sittingOrder, since that - not player
        // status - is what BenchList actually renders from. Skipping this
        // reproduces the exact "phantom player" bug the comment above
        // guards against for `slots`, just in the bench instead of the
        // court: status says 'sitting' but they're invisible everywhere,
        // since Reshuffle Teams (unlike a fresh Assign Teams) never runs
        // resolveRound afterward to rebuild sittingOrder from scratch.
        sittingOrder: [...next.sittingOrder, ...removedIds],
      };
    }
  }
  return next;
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

/** Fills every currently-empty team slot on every active court from
 * `candidates`, in fixed court/team order, each candidate placed in the
 * first open slot found. Never touches an already-occupied slot - that's
 * how continuity works: this only ever sees genuinely open seats, whether
 * they were empty to begin with or just vacated by resolveOpenSlots. */
function fillOpenSlots(state: GameState, candidates: Player[]): GameState {
  let next = state;
  let cursor = 0;
  outer: for (const { teamId, courtIndex } of TEAM_COURT_ORDER) {
    const court = next.courts.find((c) => c.index === courtIndex)!;
    if (!court.active) continue;
    for (let slotIndex = 0; slotIndex < court.sizePerTeam; slotIndex++) {
      if (next.teams[teamId].slots[slotIndex] !== null) continue;
      const candidate = candidates[cursor];
      if (!candidate) break outer; // nobody left to place; leave remaining slots open
      cursor++;
      next = placePlayerOnTeam(next, candidate.id, teamId, slotIndex);
    }
  }
  return next;
}

/**
 * Decides who fills every slot that isn't already deterministically
 * assigned (`protectedIds` - Court 1's own winner, plus anyone the
 * win-streak ladder just promoted; empty for a fresh Assign Teams with no
 * winners yet). Everyone else currently on a team ("contested incumbents" -
 * typically a losing team the ladder didn't claim) competes on equal
 * footing with the whole bench: rank the combined pool, and whoever ranks
 * in the top `openSlotCount` plays. An incumbent who makes the cut keeps
 * their exact slot untouched; one who doesn't gets bumped to the bench,
 * freeing their slot for whoever from the bench *did* make the cut.
 */
function resolveOpenSlots(state: GameState, protectedIds: Set<string>, rng: () => number = Math.random): GameState {
  const capacity = getActiveCourts(state).reduce((sum, c) => sum + c.sizePerTeam * 2, 0);
  const openSlotCount = capacity - protectedIds.size;

  const contestedIncumbents = state.players.filter((p) => p.status === 'team' && !protectedIds.has(p.id));
  const benchPool = state.players.filter((p) => p.status !== 'team');

  const ranked = rankPlayersForRound(state, [...contestedIncumbents, ...benchPool], rng);
  const enteringIds = new Set(ranked.slice(0, openSlotCount).map((p) => p.id));

  let next = state;
  for (const incumbent of contestedIncumbents) {
    if (enteringIds.has(incumbent.id)) continue; // stays exactly where they are
    const team = next.teams[incumbent.teamId!];
    next = {
      ...next,
      teams: { ...next.teams, [incumbent.teamId!]: { ...team, slots: team.slots.map((s) => (s === incumbent.id ? null : s)) } },
      players: next.players.map((p) => (p.id === incumbent.id ? { ...p, status: 'sitting', teamId: null } : p)),
    };
  }

  const newcomers = ranked.filter((p) => enteringIds.has(p.id) && p.status !== 'team');
  return fillOpenSlots(next, newcomers);
}

/** Shared tail for both assignTeams and updateWins once every deterministic
 * placement (if any) is done: fills whatever's left open, then rebuilds the
 * bench (bumps sitCount + stamps statusRound for everyone not on a team,
 * tracks who just sat for next round's fairness ranking). */
function resolveRound(state: GameState, protectedIds: Set<string>, incrementRound: boolean): GameState {
  let next = resolveOpenSlots(state, protectedIds);
  if (incrementRound) next = { ...next, round: next.round + 1 };

  const sittingOrder: string[] = [];
  const players = next.players.map((p) => {
    if (p.status === 'team') return p;
    sittingOrder.push(p.id);
    return { ...p, status: 'sitting' as const, sitCount: p.sitCount + 1, statusRound: next.round };
  });

  return { ...next, players, sittingOrder, lastSatPlayerIds: sittingOrder.slice(0, 10), lastError: null };
}

/**
 * Fills every empty team slot on every active court, then rebuilds the
 * bench. This is the single entry point both the "Assign Teams" button
 * (keepTeams=false) and "Reshuffle Teams" (keepTeams=true) call.
 */
export function assignTeams(state: GameState, keepTeams: boolean): GameState {
  if (state.players.length < 6) {
    throw new Error('Minimum 6 players required.');
  }

  const next = truncateOversizedTeams(applyDistribution(state));

  if (keepTeams) {
    // Reshuffle: just re-scramble who's currently playing among themselves -
    // no bench, no ranking, nobody's sit accounting changes.
    const playing = fisherYatesShuffle(next.players.filter((p) => p.status === 'team'));
    const teams = { ...next.teams };
    for (const id of Object.keys(teams)) {
      teams[id] = { ...teams[id], slots: teams[id].slots.map(() => null) };
    }
    const cleared = { ...next, teams, court1WinnerTeamId: null, court1WinStreak: 0 };
    return { ...fillOpenSlots(cleared, playing), lastError: null };
  }

  // assignTeams only ever fills genuinely open slots - anyone already on a
  // team (in normal UI usage there's nobody, since the "Assign Teams"
  // button is only shown when no round is in progress) is protected from
  // being reconsidered. Displacing an already-playing loser is updateWins'
  // job alone, once a round has actually been played.
  const alreadyPlaced = new Set(next.players.filter((p) => p.status === 'team').map((p) => p.id));
  return resolveRound(next, alreadyPlaced, true);
}

/** Reshuffles who's on which team without touching who's sitting or
 * advancing the round. Mirrors the original's reshuffleTeams(). */
export function reshuffleTeams(state: GameState): GameState {
  return assignTeams(state, true);
}

// ---- 5. Winner-stays rotation ----
// Replaces the original's updateWins()/moveTeam(). "Winner stays on"
// promotes a court's winner one hop toward Court 1: Court 2's winner takes
// Court 1's loser's slot; Court 3's winner takes the slot Court 2's winner
// just vacated; Court 4's winner takes the slot Court 3's winner just
// vacated; and so on for any future court count. This is deterministic -
// no ranking involved - and every court's own *loser* (other than Court 1's,
// which is unconditionally displaced by the promotion above) is left in
// place and folded into the normal fairness ranking along with the bench,
// same as anyone else: they keep their seat only if they still rank well
// enough.

function otherTeamOnCourt(court: Court, teamId: string): string {
  return teamId === court.teamAId ? court.teamBId : court.teamAId;
}

/**
 * Records who won each active court and advances "winner stays on".
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

  // ---- Court 1 win-streak cap ----
  const court1 = activeCourts.find((c) => c.index === 1)!;
  const court1WinnerId = winners[court1.id];
  const streak = court1WinnerId === next.court1WinnerTeamId ? next.court1WinStreak + 1 : 1;
  const capHit = streak >= next.maxConsecutiveWins;
  next = {
    ...next,
    court1WinnerTeamId: capHit ? null : court1WinnerId,
    court1WinStreak: capHit ? 0 : streak,
  };

  // A team can only actually be "chopped up" if there's somewhere else for
  // its players to go - with a single active court, the cap clears BOTH
  // Court 1 teams together so the fill loop reforms two genuinely new teams
  // from whoever's due, rather than the same 10 players landing right back
  // in place with nothing to displace them. With 2+ active courts, only the
  // streaking winner needs to be cleared - the ladder below always claims
  // Court 1's loser slot regardless, so that side already turns over.
  const singleCourt = activeCourts.length === 1;
  let lastNotice: string | null = null;
  if (capHit) {
    const clearTeamIds = singleCourt ? [court1.teamAId, court1.teamBId] : [court1WinnerId];
    for (const teamId of clearTeamIds) {
      const team = next.teams[teamId];
      next = {
        ...next,
        teams: { ...next.teams, [teamId]: { ...team, slots: team.slots.map(() => null) } },
        players: next.players.map((p) => (p.teamId === teamId ? { ...p, status: 'sitting', teamId: null } : p)),
      };
    }
    lastNotice = singleCourt
      ? `Court 1 teams reshuffled after ${next.maxConsecutiveWins} wins in a row.`
      : `Team ${court1WinnerId.split('-')[1]} (${next.teams[court1WinnerId].side === 'white' ? 'White' : 'Dark'}) reshuffled after ${next.maxConsecutiveWins} wins in a row.`;
  }

  // ---- Ladder: promote each court's winner into the court below it ----
  const protectedIds = new Set<string>();
  if (!capHit) {
    for (const id of next.teams[court1WinnerId].slots) if (id) protectedIds.add(id);
  }

  let destinationTeamId = otherTeamOnCourt(court1, court1WinnerId);
  for (let i = 2; i <= 4; i++) {
    const court = activeCourts.find((c) => c.index === i);
    if (!court) break;
    const winnerId = winners[court.id];
    const winnerTeam = next.teams[winnerId];
    const movedIds = winnerTeam.slots.filter((id): id is string => id !== null);
    const destTeam = next.teams[destinationTeamId];
    const displacedIds = destTeam.slots.filter((id): id is string => id !== null);

    next = {
      ...next,
      teams: {
        ...next.teams,
        [winnerId]: { ...winnerTeam, slots: winnerTeam.slots.map(() => null) },
        [destinationTeamId]: { ...destTeam, slots: [...winnerTeam.slots] },
      },
      players: next.players.map((p) => {
        if (movedIds.includes(p.id)) return { ...p, teamId: destinationTeamId };
        if (displacedIds.includes(p.id)) return { ...p, status: 'sitting', teamId: null };
        return p;
      }),
    };
    for (const id of movedIds) protectedIds.add(id);
    destinationTeamId = winnerId;
  }

  next = resolveRound(next, protectedIds, true);
  return { ...next, lastNotice };
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

  return {
    ...state,
    teams,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, status: 'sitting', teamId: null, sitCount: p.sitCount + 1, statusRound: state.round }
        : p,
    ),
    sittingOrder: [...state.sittingOrder, playerId],
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

  // Both ids are replaced in a single pass per team, not two sequential
  // passes - when a and b are on the *same* team, doing it as two separate
  // single-id replacements meant the second pass read the first pass's
  // already-mutated slots (both slots now holding b's id) and blew away
  // every occurrence, leaving both slots showing a's id and b gone
  // entirely, instead of the two simply trading places.
  const teams = { ...state.teams };
  const teamIds = new Set([a.teamId, b.teamId].filter((id): id is string => id !== null));
  for (const teamId of teamIds) {
    const team = teams[teamId];
    teams[teamId] = {
      ...team,
      slots: team.slots.map((s) => (s === playerAId ? playerBId : s === playerBId ? playerAId : s)),
    };
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

  return { ...state, teams, players, sittingOrder, lastError: null };
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
 * ever being reconsidered: a team promoted all the way up the ladder
 * without ever losing (no streak cap applies until it reaches Court 1), or
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
