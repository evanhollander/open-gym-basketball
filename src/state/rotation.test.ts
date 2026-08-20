import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, updateWins, sitPlayer, swapPlayers, clearTeams, clearSat } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = createInitialState()): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('updateWins', () => {
  it('requires teams to be assigned first', () => {
    expect(() => updateWins(withPlayers(10), {})).toThrow(/assign teams first/i);
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
    expect(state.maxSit).toBe(1);
    expect(state.players.every((p) => p.sitCount === 0)).toBe(true);
  });
});
