import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, isRiskyStreakSetup, findUnfairSecondSit } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = { ...createInitialState(), numCourts: 1 }): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('isRiskyStreakSetup', () => {
  it('flags 13 players, 1 court, and a Winner Stays On cap above 2', () => {
    const state = { ...withPlayers(13), maxConsecutiveWins: 3 };
    expect(isRiskyStreakSetup(state)).toBe(true);
  });

  it('does not flag once the cap is already 2 or lower', () => {
    const state = { ...withPlayers(13), maxConsecutiveWins: 2 };
    expect(isRiskyStreakSetup(state)).toBe(false);
  });

  it('does not flag once a 2nd court is enabled', () => {
    const state = { ...withPlayers(13), numCourts: 2 as const, maxConsecutiveWins: 3 };
    expect(isRiskyStreakSetup(state)).toBe(false);
  });

  it('does not flag when the bench is already as big as a full team', () => {
    // 20 players, 1 court -> soloCourtSize caps at 5, bench of 10 is plenty
    // to fully refill the losing side without recycling anyone.
    const state = { ...withPlayers(20), maxConsecutiveWins: 3 };
    expect(isRiskyStreakSetup(state)).toBe(false);
  });
});

describe('findUnfairSecondSit', () => {
  it('returns null when no team is on a win streak', () => {
    const state = withPlayers(13);
    expect(findUnfairSecondSit(state)).toBeNull();
  });

  it('flags a bench player with 2+ sits while the protected winning team has a never-sat player', () => {
    let state = withPlayers(13);
    const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, bench1, bench2, repeatSitter] = state.players;
    const winningTeamId = 'team-1';
    const losingTeamId = 'team-2';
    state = {
      ...state,
      court1WinnerTeamId: winningTeamId,
      court1WinStreak: 1,
      sittingOrder: [bench1.id, bench2.id, repeatSitter.id],
      teams: {
        ...state.teams,
        [winningTeamId]: { ...state.teams[winningTeamId], slots: [p1.id, p2.id, p3.id, p4.id, p5.id] },
        [losingTeamId]: { ...state.teams[losingTeamId], slots: [p6.id, p7.id, p8.id, p9.id, p10.id] },
      },
      players: state.players.map((p) => {
        if ([p1, p2, p3, p4, p5].some((w) => w.id === p.id)) return { ...p, status: 'team', teamId: winningTeamId, sitCount: 0 };
        if ([p6, p7, p8, p9, p10].some((w) => w.id === p.id)) return { ...p, status: 'team', teamId: losingTeamId };
        if (p.id === repeatSitter.id) return { ...p, status: 'sitting', sitCount: 2 };
        return { ...p, status: 'sitting' };
      }),
    };

    const result = findUnfairSecondSit(state);
    expect(result).not.toBeNull();
    expect(result?.repeatSitterId).toBe(repeatSitter.id);
    expect([p1.id, p2.id, p3.id, p4.id, p5.id]).toContain(result?.winningPlayerId);
  });

  it('returns null once every player on the winning team has sat at least once', () => {
    let state = withPlayers(13);
    const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, bench1, bench2, repeatSitter] = state.players;
    const winningTeamId = 'team-1';
    const losingTeamId = 'team-2';
    state = {
      ...state,
      court1WinnerTeamId: winningTeamId,
      court1WinStreak: 1,
      sittingOrder: [bench1.id, bench2.id, repeatSitter.id],
      teams: {
        ...state.teams,
        [winningTeamId]: { ...state.teams[winningTeamId], slots: [p1.id, p2.id, p3.id, p4.id, p5.id] },
        [losingTeamId]: { ...state.teams[losingTeamId], slots: [p6.id, p7.id, p8.id, p9.id, p10.id] },
      },
      players: state.players.map((p) => {
        if ([p1, p2, p3, p4, p5].some((w) => w.id === p.id)) return { ...p, status: 'team', teamId: winningTeamId, sitCount: 1 };
        if ([p6, p7, p8, p9, p10].some((w) => w.id === p.id)) return { ...p, status: 'team', teamId: losingTeamId };
        if (p.id === repeatSitter.id) return { ...p, status: 'sitting', sitCount: 2 };
        return { ...p, status: 'sitting' };
      }),
    };

    expect(findUnfairSecondSit(state)).toBeNull();
  });
});
