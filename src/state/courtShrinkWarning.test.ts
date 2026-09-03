import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, courtShrinkWarning, removePlayer } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = { ...createInitialState(), numCourts: 2 }): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('courtShrinkWarning', () => {
  it('returns null before any court is active (first Assign Teams of the day)', () => {
    const state = withPlayers(17);
    expect(courtShrinkWarning(state)).toBeNull();
  });

  it('returns null when 17 -> 15 just resizes Court 2 without losing it', () => {
    let state = assignTeams(withPlayers(17), false);
    const [leaver1, leaver2] = state.players;
    state = removePlayer(removePlayer(state, leaver1.id), leaver2.id);

    expect(courtShrinkWarning(state)).toBeNull();
  });

  it('flags 15 -> 13 crossing the maxSingleCourtPlayers gate and dropping Court 2 entirely', () => {
    let state = assignTeams(withPlayers(15), false);
    const [leaver1, leaver2] = state.players;
    state = removePlayer(removePlayer(state, leaver1.id), leaver2.id);

    expect(courtShrinkWarning(state)).toEqual({ from: 2, to: 1 });
  });

  it('returns null once maxSingleCourtPlayers is lowered enough to keep both courts', () => {
    let state = assignTeams(withPlayers(15), false);
    const [leaver1, leaver2] = state.players;
    state = removePlayer(removePlayer(state, leaver1.id), leaver2.id);
    state = { ...state, maxSingleCourtPlayers: 12 };

    expect(courtShrinkWarning(state)).toBeNull();
  });
});
