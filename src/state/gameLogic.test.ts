import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, removePlayer, resetAll } from './gameLogic';

describe('addPlayer', () => {
  it('adds a player with status none and sitCount 0 before any round starts', () => {
    const state = addPlayer(createInitialState(), 'Alex');
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({ name: 'Alex', status: 'none', sitCount: 0 });
  });

  it('rejects names under 2 characters', () => {
    expect(() => addPlayer(createInitialState(), 'A')).toThrow(/at least 2 characters/i);
  });

  it('rejects duplicate names', () => {
    const state = addPlayer(createInitialState(), 'Alex');
    expect(() => addPlayer(state, 'Alex')).toThrow(/already exists/i);
  });

  it('caps the roster at 50 players', () => {
    let state = createInitialState();
    for (let i = 0; i < 50; i++) state = addPlayer(state, `Player${i}`);
    expect(() => addPlayer(state, 'OneTooMany')).toThrow(/max is 50/i);
  });

  it('starts a mid-round joiner with sitCount 1 so they cannot skip the bench queue', () => {
    const state = { ...createInitialState(), round: 3 };
    const result = addPlayer(state, 'LateJoiner');
    expect(result.players[0].sitCount).toBe(1);
  });
});

describe('removePlayer', () => {
  it('removes the player from the roster with no renumbering needed', () => {
    let state = addPlayer(createInitialState(), 'Alex');
    state = addPlayer(state, 'Sam');
    const [alex] = state.players;
    state = removePlayer(state, alex.id);
    expect(state.players.map((p) => p.name)).toEqual(['Sam']);
  });

  it('clears the player out of any team slot they occupied', () => {
    let state = addPlayer(createInitialState(), 'Alex');
    const [alex] = state.players;
    state = {
      ...state,
      players: state.players.map((p) => (p.id === alex.id ? { ...p, teamId: 'team-1' } : p)),
      teams: {
        ...state.teams,
        'team-1': { ...state.teams['team-1'], slots: [alex.id, null, null, null, null] },
      },
    };
    state = removePlayer(state, alex.id);
    expect(state.teams['team-1'].slots).toEqual([null, null, null, null, null]);
  });
});

describe('resetAll', () => {
  it('clears players and resets round/maxSit/win-streak state', () => {
    let state = addPlayer(createInitialState(), 'Alex');
    state = { ...state, round: 5, maxSit: 3, court1WinStreak: 2 };
    state = resetAll(state);
    expect(state.players).toEqual([]);
    expect(state.round).toBe(0);
    expect(state.maxSit).toBe(1);
    expect(state.court1WinStreak).toBe(0);
  });
});
