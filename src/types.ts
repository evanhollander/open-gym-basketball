// Shared vocabulary for the whole app. Kept in one file on purpose (see
// OPEN_GYM_LOGIC.md's port plan) so anyone new to the codebase can read the
// full data model top-to-bottom instead of hopping between files.
//
// This is a port of a single-file HTML app (fdarosa.com/open-gym-basketball.html)
// that kept its state as strings inside DOM elements (e.g. an element with
// id="name17" held player #17's name, id="num3-2" held the player number
// sitting in Team 3's 2nd slot). Here every player has a stable `id` instead
// of a position, and every team just holds an array of player ids — no more
// string-concatenated element ids, and no more shuffling every player's
// number down by one when someone is removed (the original's `RemovePlayer`
// had to do that; this model never needs to).

/**
 * Where a player currently stands in the rotation.
 * - 'team'    - actively playing (on some Team's slots)
 * - 'sitting' - on the bench, next in line by normal turn order
 * - 'next'    - on the bench, explicitly bumped up to play the very next opening
 * - 'holding' - just came off a team; deliberately skipped for a bit so they
 *               don't immediately play again ahead of players who sat longer
 * - 'pending' - came off a team AND has already sat enough rounds to be fully
 *               eligible again (a step past 'holding')
 * - 'none'    - just added, hasn't played or sat yet
 */
export type PlayerStatus = 'none' | 'team' | 'sitting' | 'next' | 'holding' | 'pending';

export interface Player {
  id: string;
  name: string;
  status: PlayerStatus;
  /** Which team this player is on right now, or null if not on a team. */
  teamId: string | null;
  /** How many rounds this player has sat out, all-time. Drives fairness: the
   * shuffle cascade prefers players with a *higher* sitCount when picking who
   * plays next. */
  sitCount: number;
  /** The round number as of this player's last sitCount change. Used both to
   * check "did this player sit last round?" (see checkLastSat) and to guard
   * against double-counting a sit when a bench player is dragged straight
   * onto a team within the same round they were just benched in (see
   * movePlayer's same-round guard, section 6). */
  statusRound: number;
}

export type TeamSide = 'white' | 'dark';

export interface Team {
  id: string; // 'team-1' .. 'team-8'
  courtId: string;
  side: TeamSide;
  /** Fixed-length slots, one per player-per-team. A null entry is an open
   * slot (a valid drag-and-drop target); a player id fills a slot. Resized
   * by distributePlayers()/assignTeams() whenever court sizes change. */
  slots: (string | null)[];
}

export interface Court {
  id: string; // 'court-1' .. 'court-4'
  index: 1 | 2 | 3 | 4;
  active: boolean;
  /** Players per team on this court (0 if inactive). */
  sizePerTeam: number;
  teamAId: string;
  teamBId: string;
}

/** "Minimum Game" setting from the original: the smallest team size the app
 * will ever use, which in turn decides when a 2nd/3rd/4th court turns on. */
export type GameType = 2 | 3 | 4 | 5;

export interface GameState {
  players: Player[];
  /** All 8 teams, always present (courts 1-4 x teams A/B), keyed by id. */
  teams: Record<string, Team>;
  /** All 4 courts, always present; `active` flags which ones are in use. */
  courts: Court[];
  numCourts: 1 | 2 | 3 | 4;
  gameType: GameType;
  /**
   * NEW setting, not in the original app: caps players-per-team so the app
   * never grows a court past this size even if there are enough players to
   * fill a bigger game. Example: 18 players, 2 courts, gameType=3 (3v3
   * minimum) - uncapped, the original always maximizes who's playing and
   * would force a 5v5 on Court 1 + 4v4 on Court 2 (0 sitting). With
   * maxTeamSize=4, both courts cap at 4v4 and the 2 extra players sit and
   * rotate in instead of being forced into a bigger game.
   * null = uncapped, i.e. identical to the original's always-maximize behavior.
   */
  maxTeamSize: GameType | null;
  /** Bumped each time assignTeams() deals a fresh round (not on reshuffle). */
  round: number;
  /** The most rounds anyone has sat, all-time so far. Acts as the fairness
   * bar: nobody sits again until enough other players have caught up to it. */
  maxSit: number;
  /** How many rounds in a row a team can keep winning Court 1 before it's
   * forced to sit out, win or not - stops one team hogging the main court. */
  maxConsecutiveWins: number;
  /** Court 2 only engages once the player count exceeds this - below it,
   * everyone stays on a single (fuller) court rather than splitting into
   * two smaller games. Adjustable 3-13, default 13. Note: the actual
   * effect is also bounded by Minimum Game - you can't split into two
   * valid games below whatever that format requires (e.g. two 3v3 courts
   * need 12 players minimum), so lowering this below that floor has no
   * further effect. */
  maxSingleCourtPlayers: number;
  court1WinnerTeamId: string | null;
  court1WinStreak: number;
  /** Ids of players who sat the previous round, most-recent round first,
   * capped at 10. Used by checkLastSat() so the same people don't get
   * benched two rounds running. */
  lastSatPlayerIds: string[];
  /** Bench, in display/turn order. */
  sittingOrder: string[];
  /** Set by the reducer when a gameLogic function rejects an action (e.g.
   * "need at least 6 players"), shown as a toast instead of the original's
   * alert() popups. Cleared on the next successful action. */
  lastError: string | null;
  /** UI preference, not game data - stored here anyway since it's the one
   * blob already persisted to localStorage. 'system' (default) follows the
   * OS/browser's prefers-color-scheme; 'light'/'dark' force it regardless -
   * see ThemeManager.tsx for where this actually gets applied. */
  theme: Theme;
}

export type Theme = 'light' | 'dark' | 'system';

/** Where a dragged player card was dropped. */
export type DropTarget =
  | { kind: 'team-slot'; teamId: string; slotIndex: number }
  | { kind: 'bench' };

// One action per user-facing operation from the original app (see
// OPEN_GYM_LOGIC.md for the legacy function each of these replaces).
export type Action =
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_GAME_TYPE'; gameType: GameType }
  | { type: 'SET_NUM_COURTS'; numCourts: 1 | 2 | 3 | 4 }
  | { type: 'SET_MAX_TEAM_SIZE'; maxTeamSize: GameType | null }
  | { type: 'SET_MAX_SIT'; maxSit: number }
  | { type: 'SET_MAX_CONSECUTIVE_WINS'; value: number }
  | { type: 'SET_MAX_SINGLE_COURT_PLAYERS'; value: number }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'ASSIGN_TEAMS'; keepTeams?: boolean }
  | { type: 'RESHUFFLE_TEAMS' }
  | { type: 'SUBMIT_WINNERS'; winners: Record<string, string> } // courtId -> winning teamId
  | { type: 'MOVE_PLAYER'; playerId: string; target: DropTarget }
  | { type: 'CLEAR_TEAMS' }
  | { type: 'CLEAR_SAT' }
  | { type: 'UPDATE_ROUND' }
  | { type: 'RESET_ALL' }
  | { type: 'LOAD_STATE'; state: GameState };
