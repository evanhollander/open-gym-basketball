import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, updateWins, sitPlayer, swapPlayers, clearTeams, clearSat } from './gameLogic';
import type { GameState } from '../types';

// Pinned to numCourts: 1 (rather than relying on the app's default) since
// these tests are built around single-court distribution math (10 players
// -> 5v5, 12 players -> 5v5 + 2 sitting) - explicit here so a future change
// to the default doesn't silently change what scenario each test exercises.
function withPlayers(count: number, state: GameState = { ...createInitialState(), numCourts: 1 }): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('updateWins', () => {
  it('requires teams to be assigned first', () => {
    expect(() => updateWins(withPlayers(10), {})).toThrow(/assign teams first/i);
  });

  it('does not require teams again just because Clear # Games Sat reset the round counter', () => {
    // Regression: Clear # Games Sat resets `round` to 0 without touching
    // who's on a team. updateWins used to check `round === 0` directly,
    // so clicking Clear # Games Sat mid-round (teams still fully assigned)
    // made Submit Winners throw "Assign Teams first" even though the UI -
    // which checks team assignment, not round - kept showing the button.
    let state = assignTeams(withPlayers(10), false);
    state = clearSat(state);
    expect(state.round).toBe(0);
    expect(state.players.some((p) => p.status === 'team')).toBe(true);

    const court1 = state.courts.find((c) => c.index === 1)!;
    expect(() => updateWins(state, { [court1.id]: court1.teamAId })).not.toThrow();
  });

  it('requires a winner for every active court', () => {
    const state = assignTeams(withPlayers(10), false);
    const court1 = state.courts.find((c) => c.index === 1)!;
    expect(() => updateWins(state, {})).toThrow(/select a winner/i);
    // Providing a winner should stop throwing for a single-court game.
    expect(() => updateWins(state, { [court1.id]: court1.teamAId })).not.toThrow();
  });

  it('keeps the winning team on Court 1 and benches the losing team', () => {
    const state = assignTeams(withPlayers(10), false);
    const court1 = state.courts.find((c) => c.index === 1)!;
    const winnerIdsBefore = state.teams[court1.teamAId].slots.filter((s): s is string => s !== null);

    const after = updateWins(state, { [court1.id]: court1.teamAId });

    // Winner's original players are still on Team 1 (court1.teamAId).
    const stillOnTeamA = winnerIdsBefore.every((id) => after.teams[court1.teamAId].slots.includes(id));
    expect(stillOnTeamA).toBe(true);
    expect(after.court1WinnerTeamId).toBe(court1.teamAId);
    expect(after.court1WinStreak).toBe(1);
  });

  it('forces the winning team to sit once the consecutive-win cap is hit', () => {
    let state = assignTeams(withPlayers(10), false);
    const court1 = state.courts.find((c) => c.index === 1)!;
    state = { ...state, maxConsecutiveWins: 2 };

    // Team A wins twice in a row -> streak hits the cap on the 2nd win.
    state = updateWins(state, { [court1.id]: court1.teamAId });
    expect(state.court1WinStreak).toBe(1);
    state = updateWins(state, { [court1.id]: court1.teamAId });

    // Streak cap reached: tracking resets, Team A no longer recorded as the
    // reigning winner (they were forced to rotate off despite winning).
    expect(state.court1WinStreak).toBe(0);
    expect(state.court1WinnerTeamId).toBe(null);
  });

  it('reforms both Court 1 teams from scratch when the cap is hit, not just a 1-seat swap', () => {
    // Regression: hitting the cap used to only vacate the actual winner's
    // slots while leaving the actual loser's roster completely untouched -
    // with a small bench (or, as here, none at all - exactly 10 players),
    // that meant the "forced rotation" was invisible: the winner's own
    // 5 just-vacated players were the only candidates left to refill their
    // own 5 slots, so both teams ended up looking exactly like before. The
    // cap should instead pool all 10 currently-playing players together and
    // let them freely re-split across both sides.
    const original = assignTeams(withPlayers(10), false);
    const court1 = original.courts.find((c) => c.index === 1)!;
    const originalTeamBIds = [...original.teams[court1.teamBId].slots].sort();

    let sawReshuffledSplit = false;
    for (let i = 0; i < 30; i++) {
      let state = { ...original, maxConsecutiveWins: 2 };
      state = updateWins(state, { [court1.id]: court1.teamAId }); // win 1
      state = updateWins(state, { [court1.id]: court1.teamAId }); // win 2 -> cap hits

      expect(state.court1WinnerTeamId).toBeNull();
      const newTeamBIds = [...state.teams[court1.teamBId].slots].sort();
      if (JSON.stringify(newTeamBIds) !== JSON.stringify(originalTeamBIds)) {
        sawReshuffledSplit = true;
        break;
      }
    }
    expect(sawReshuffledSplit).toBe(true);
  });

  it('advances the round via the trailing assignTeams refill', () => {
    const state = assignTeams(withPlayers(10), false);
    const court1 = state.courts.find((c) => c.index === 1)!;
    const after = updateWins(state, { [court1.id]: court1.teamAId });
    expect(after.round).toBe(state.round + 1);
  });
});

describe('sitPlayer', () => {
  it('benches a player who is on a team, incrementing their sit count', () => {
    const state = assignTeams(withPlayers(10), false);
    const onTeam = state.players.find((p) => p.status === 'team')!;
    const after = sitPlayer(state, onTeam.id);
    const updated = after.players.find((p) => p.id === onTeam.id)!;
    expect(updated.status).toBe('sitting');
    expect(updated.sitCount).toBe(onTeam.sitCount + 1);
    expect(after.sittingOrder).toContain(onTeam.id);
  });

  it('rejects sitting a player who is not currently on a team', () => {
    const state = assignTeams(withPlayers(12), false); // 2 players end up sitting
    const sitting = state.players.find((p) => p.status === 'sitting')!;
    expect(() => sitPlayer(state, sitting.id)).toThrow(/not currently on a team/i);
  });
});

describe('swapPlayers', () => {
  it('exchanges a team player with a bench player', () => {
    const state = assignTeams(withPlayers(12), false);
    const onTeam = state.players.find((p) => p.status === 'team')!;
    const sitting = state.players.find((p) => p.status === 'sitting')!;

    const after = swapPlayers(state, onTeam.id, sitting.id);
    const updatedOnTeamPlayer = after.players.find((p) => p.id === onTeam.id)!;
    const updatedSittingPlayer = after.players.find((p) => p.id === sitting.id)!;

    expect(updatedOnTeamPlayer.status).toBe('sitting');
    expect(updatedSittingPlayer.status).toBe('team');
    expect(after.teams[updatedSittingPlayer.teamId!].slots).toContain(sitting.id);
    expect(after.sittingOrder).toContain(onTeam.id);
    expect(after.sittingOrder).not.toContain(sitting.id);
  });

  it('counts a sit against the player displaced to the bench', () => {
    const state = assignTeams(withPlayers(12), false);
    const onTeam = state.players.find((p) => p.status === 'team')!;
    const sitting = state.players.find((p) => p.status === 'sitting')!;
    const before = onTeam.sitCount;

    const after = swapPlayers(state, sitting.id, onTeam.id);

    expect(after.players.find((p) => p.id === onTeam.id)!.sitCount).toBe(before + 1);
  });

  it('refunds a same-round bench bump for the player swapped onto a team', () => {
    // 12 players, 1 default court (5v5) -> 2 end up freshly benched this
    // round, sitCount bumped to 1 with statusRound === current round.
    const state = assignTeams(withPlayers(12), false);
    const freshlyBenched = state.players.find((p) => p.id === state.sittingOrder[0])!;
    expect(freshlyBenched.sitCount).toBe(1);
    expect(freshlyBenched.statusRound).toBe(state.round);
    const onTeam = state.players.find((p) => p.status === 'team')!;

    const after = swapPlayers(state, freshlyBenched.id, onTeam.id);

    // They never actually sat out a round, so the bump should be undone.
    expect(after.players.find((p) => p.id === freshlyBenched.id)!.sitCount).toBe(0);
  });

  it('does not refund a sit from an earlier round when swapped onto a team', () => {
    const state = assignTeams(withPlayers(12), false);
    const benchedEarlier = state.players.find((p) => p.id === state.sittingOrder[0])!;
    // Simulate they sat out a round two rounds ago (not this round).
    const stale = {
      ...state,
      players: state.players.map((p) =>
        p.id === benchedEarlier.id ? { ...p, sitCount: 3, statusRound: state.round - 2 } : p,
      ),
    };
    const onTeam = stale.players.find((p) => p.status === 'team')!;

    const after = swapPlayers(stale, benchedEarlier.id, onTeam.id);

    expect(after.players.find((p) => p.id === benchedEarlier.id)!.sitCount).toBe(3);
  });

  it('leaves sit counts untouched when swapping two players already on teams', () => {
    const state = assignTeams(withPlayers(10), false);
    const [p1, p2] = state.players.filter((p) => p.status === 'team');
    const after = swapPlayers(state, p1.id, p2.id);
    expect(after.players.find((p) => p.id === p1.id)!.sitCount).toBe(p1.sitCount);
    expect(after.players.find((p) => p.id === p2.id)!.sitCount).toBe(p2.sitCount);
  });
});

describe('clearTeams', () => {
  it('empties every team slot and puts everyone back to none', () => {
    const state = assignTeams(withPlayers(10), false);
    const after = clearTeams(state);
    expect(after.players.every((p) => p.status === 'none')).toBe(true);
    expect(Object.values(after.teams).every((t) => t.slots.every((s) => s === null))).toBe(true);
  });
});

describe('clearSat', () => {
  it('resets round and every player sitCount to 0', () => {
    let state = assignTeams(withPlayers(12), false);
    state = clearSat(state);
    expect(state.round).toBe(0);
    expect(state.players.every((p) => p.sitCount === 0)).toBe(true);
  });
});

describe('updateWins - multi-court ladder', () => {
  function withTwoCourts(count: number): GameState {
    return withPlayers(count, { ...createInitialState(), numCourts: 2 });
  }

  it('promotes a winning team up the ladder into the court below when multiple courts are active', () => {
    let state = withTwoCourts(20); // 2 courts, 5v5 each, 0 bench
    state = assignTeams(state, false);
    const court1 = state.courts.find((c) => c.index === 1)!;
    const court2 = state.courts.find((c) => c.index === 2)!;
    const court1WinnerId = court1.teamAId;
    const court1LoserId = court1.teamBId;
    const court2WinnerId = court2.teamAId;
    const court2WinnerPlayers = [...state.teams[court2WinnerId].slots].sort();

    const after = updateWins(state, { [court1.id]: court1WinnerId, [court2.id]: court2WinnerId });

    // Court 2's winning team now occupies Court 1's former loser slot,
    // intact as a block - not decided by the fairness ranking at all.
    expect([...after.teams[court1LoserId].slots].sort()).toEqual(court2WinnerPlayers);
    for (const id of court2WinnerPlayers) {
      expect(after.players.find((p) => p.id === id)!.teamId).toBe(court1LoserId);
    }
  });

  it('still promotes normally on a capped round, but the capped winner is no longer guaranteed to stay intact', () => {
    let original = withTwoCourts(20);
    original = assignTeams({ ...original, maxConsecutiveWins: 2 }, false);
    const court1 = original.courts.find((c) => c.index === 1)!;
    const court2 = original.courts.find((c) => c.index === 2)!;
    const court1WinnerId = court1.teamAId;
    const court1LoserId = court1.teamBId;

    let sawWinnerBrokenUp = false;
    for (let i = 0; i < 30; i++) {
      // Win #1 - no cap yet.
      const state = updateWins(original, { [court1.id]: court1WinnerId, [court2.id]: court2.teamAId });
      const winnerPlayersBeforeCap = [...state.teams[court1WinnerId].slots].sort();
      const court2WinnerId = state.courts.find((c) => c.index === 2)!.teamAId;
      const court2WinnerPlayers = [...state.teams[court2WinnerId].slots].sort();

      // Win #2 - same team wins Court 1 again, cap hits.
      const after = updateWins(state, { [court1.id]: court1WinnerId, [court2.id]: court2WinnerId });

      expect(after.court1WinnerTeamId).toBeNull();
      expect(after.lastNotice).toMatch(/reshuffled after 2 wins in a row/i);
      // The ladder promotion into Court 1's loser slot still happens
      // normally, independent of the cap.
      expect([...after.teams[court1LoserId].slots].sort()).toEqual(court2WinnerPlayers);

      const stillFullyIntact = winnerPlayersBeforeCap.every((id) => after.teams[court1WinnerId].slots.includes(id));
      if (!stillFullyIntact) {
        sawWinnerBrokenUp = true;
        break;
      }
    }
    expect(sawWinnerBrokenUp).toBe(true);
  });
});
