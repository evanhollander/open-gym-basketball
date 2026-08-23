import type { Court, GameState, Team } from '../types';

// Court n hosts Team (2n-1) as White and Team (2n) as Dark - same pairing as
// the original (Court 1 = Team 1/2, Court 2 = Team 3/4, etc.).
function buildCourtsAndTeams(): { courts: Court[]; teams: Record<string, Team> } {
  const courts: Court[] = [];
  const teams: Record<string, Team> = {};

  for (let i = 1; i <= 4; i++) {
    const courtId = `court-${i}`;
    const teamAId = `team-${2 * i - 1}`;
    const teamBId = `team-${2 * i}`;
    // Court 1 defaults to an active 5v5, matching the original's default
    // before any player-count-based resizing happens in distributePlayers().
    const active = i === 1;
    const sizePerTeam = active ? 5 : 0;

    courts.push({ id: courtId, index: i as 1 | 2 | 3 | 4, active, sizePerTeam, teamAId, teamBId });
    // Slots are always a fixed length of 5 (the max team size), regardless
    // of the court's current sizePerTeam - same as the original always
    // having 5 DOM rows per team and simply never filling past whatever
    // count distributePlayers() computed. This avoids ever having to resize
    // (and evict players from) this array when court sizes change.
    teams[teamAId] = { id: teamAId, courtId, side: 'white', slots: new Array(5).fill(null) };
    teams[teamBId] = { id: teamBId, courtId, side: 'dark', slots: new Array(5).fill(null) };
  }

  return { courts, teams };
}

export function createInitialState(): GameState {
  const { courts, teams } = buildCourtsAndTeams();
  return {
    players: [],
    teams,
    courts,
    // Defaults to 2 rather than 1: a single court leaves more than half a
    // typical-sized group (e.g. 18 players) benched with no obvious hint
    // that more courts are available in Settings. Harmless for small
    // groups - Court 2 stays inactive until there are enough players for
    // it regardless of this setting (see distributePlayers).
    numCourts: 2,
    gameType: 3, // "3 v 3" minimum, same default as the original
    maxTeamSize: null, // uncapped by default = identical to original behavior
    round: 0,
    maxSit: 1,
    maxConsecutiveWins: 3,
    maxSingleCourtPlayers: 13,
    court1WinnerTeamId: null,
    court1WinStreak: 0,
    lastSatPlayerIds: [],
    sittingOrder: [],
    lastError: null,
  };
}
