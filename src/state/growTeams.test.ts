import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, courtGrowthAvailable, growTeams } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = { ...createInitialState(), numCourts: 2 }): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('courtGrowthAvailable', () => {
  it('is null before any round has started, even if distribution would differ', () => {
    const state = withPlayers(17); // never assigned - no round in progress
    expect(courtGrowthAvailable(state)).toBeNull();
  });

  it('is null when the roster has not grown enough to change distribution', () => {
    let state = withPlayers(14); // 4v4 + 3v3, 0 bench - band is 14 <= players < 16
    state = assignTeams(state, false);
    state = addPlayer(state, 'OneMore'); // 15 - still within the same band
    expect(courtGrowthAvailable(state)).toBeNull();
  });

  // Regression: the reported case - 15 players (4v4 + 3v3, 1 bench) grows to
  // 17 mid-round, crossing into the 16-<18 band (4v4 + 4v4). Distribution
  // only recomputes when Assign/Reshuffle Teams runs, and mid-round only
  // Reshuffle Teams is ever shown - but Reshuffle only re-scrambles players
  // already on a team, so the extra capacity would silently never get
  // filled. This selector is what lets the UI notice the mismatch live.
  it('detects the 15 -> 17 mid-round growth case (4v4/3v3 -> 4v4/4v4)', () => {
    let state = withPlayers(15);
    state = assignTeams(state, false);
    state = addPlayer(state, 'New1');
    state = addPlayer(state, 'New2');

    const growth = courtGrowthAvailable(state);
    expect(growth).toEqual({ currentCapacity: 14, newCapacity: 16 });
  });
});

describe('growTeams', () => {
  it('fills exactly the newly-opened slots and leaves already-playing players untouched', () => {
    let state = withPlayers(15);
    state = assignTeams(state, false);
    const onCourtBefore = Object.values(state.teams).flatMap((t) => t.slots.filter((s): s is string => s !== null));

    state = addPlayer(state, 'New1');
    state = addPlayer(state, 'New2');
    const after = growTeams(state);

    expect(courtGrowthAvailable(after)).toBeNull(); // capacity now fully matches distribution
    const onCourtAfter = Object.values(after.teams).flatMap((t) => t.slots.filter((s): s is string => s !== null));
    expect(onCourtAfter).toHaveLength(16);
    // Everyone who was already playing is still playing, in the same team.
    for (const id of onCourtBefore) {
      expect(onCourtAfter).toContain(id);
    }
  });

  it('places brand-new mid-round joiners onto a court when they rank well enough', () => {
    let state = withPlayers(15);
    state = assignTeams(state, false);
    state = addPlayer(state, 'New1');
    state = addPlayer(state, 'New2');
    const newIds = state.players.filter((p) => p.name.startsWith('New')).map((p) => p.id);

    const after = growTeams(state);
    const onCourtAfter = new Set(Object.values(after.teams).flatMap((t) => t.slots.filter((s): s is string => s !== null)));
    for (const id of newIds) {
      expect(onCourtAfter.has(id)).toBe(true);
      expect(after.players.find((p) => p.id === id)!.status).toBe('team');
    }
  });

  it('keeps every player accounted for exactly once (on a court or the bench), no phantom players', () => {
    let state = withPlayers(15);
    state = assignTeams(state, false);
    state = addPlayer(state, 'New1');
    state = addPlayer(state, 'New2');

    const after = growTeams(state);
    const onCourt = Object.values(after.teams).flatMap((t) => t.slots.filter((s): s is string => s !== null));
    const combined = [...onCourt, ...after.sittingOrder].sort();
    expect(combined).toEqual(after.players.map((p) => p.id).sort());
    expect(new Set(combined).size).toBe(after.players.length);
  });

  it('refunds a same-round sit-count bump for a bench player who fills a newly-opened slot', () => {
    let state = withPlayers(15); // 4v4 + 3v3, 1 already-benched player at sitCount 1
    state = assignTeams(state, false);
    const alreadyBenched = state.players.find((p) => p.status === 'sitting')!;
    expect(alreadyBenched.sitCount).toBe(1);
    expect(alreadyBenched.statusRound).toBe(state.round);

    state = addPlayer(state, 'New1');
    state = addPlayer(state, 'New2'); // now supports 4v4/4v4 - 2 new open slots
    const after = growTeams(state);

    const updated = after.players.find((p) => p.id === alreadyBenched.id)!;
    if (updated.status === 'team') {
      // They weren't actually sitting out this round after all - refunded.
      expect(updated.sitCount).toBe(0);
    }
  });

  it('is a no-op when there is no spare capacity to fill', () => {
    let state = withPlayers(15);
    state = assignTeams(state, false);
    const before = state;
    const after = growTeams(state);
    expect(after.players.filter((p) => p.status === 'team')).toHaveLength(
      before.players.filter((p) => p.status === 'team').length,
    );
  });
});
