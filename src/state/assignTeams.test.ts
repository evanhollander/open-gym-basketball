import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, reshuffleTeams } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = createInitialState()): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

function countByStatus(state: GameState) {
  return state.players.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
}

describe('assignTeams', () => {
  it('requires at least 6 players', () => {
    expect(() => assignTeams(withPlayers(5), false)).toThrow(/minimum 6 players/i);
  });

  it('fills every slot when player count exactly matches court capacity', () => {
    // 1 court, 10 players -> soloCourtSize(10) = 5, so 5v5 fills everyone.
    const state = assignTeams(withPlayers(10), false);
    const statuses = countByStatus(state);
    expect(statuses.team).toBe(10);
    expect(statuses.sitting ?? 0).toBe(0);
    expect(state.sittingOrder).toHaveLength(0);
  });

  it('benches the overflow when there are more players than court capacity', () => {
    // 1 court, 12 players -> soloCourtSize(12) = 5 (default), 10 play, 2 sit.
    const state = assignTeams(withPlayers(12), false);
    const statuses = countByStatus(state);
    expect(statuses.team).toBe(10);
    expect(statuses.sitting).toBe(2);
    expect(state.sittingOrder).toHaveLength(2);
  });

  it('increments the round on a normal assign, not on reshuffle', () => {
    const assigned = assignTeams(withPlayers(10), false);
    expect(assigned.round).toBe(1);

    const reshuffled = reshuffleTeams(assigned);
    expect(reshuffled.round).toBe(1);
  });

  it('respects the Max Team Size cap, benching players who would otherwise have played', () => {
    // 18 players, 2 courts, 3v3 minimum: uncapped fits everyone (5+4 per side = 18).
    let state = withPlayers(18);
    state = { ...state, numCourts: 2 };
    const uncapped = assignTeams(state, false);
    expect(countByStatus(uncapped).sitting ?? 0).toBe(0);

    // Capped at 4v4: both courts clamp to 4, so 16 play and 2 sit.
    const capped = assignTeams({ ...state, maxTeamSize: 4 }, false);
    expect(countByStatus(capped).team).toBe(16);
    expect(countByStatus(capped).sitting).toBe(2);
  });

  it('benches the overflow (no one vanishes) when a cap is applied AFTER teams were already assigned larger', () => {
    // Regression test: assigning uncapped first fills every team to its
    // full (larger) size; applying the cap afterward must correctly bench
    // whoever no longer fits, not leave them stuck marked 'team' in a slot
    // index that no longer exists (invisible on both the court and bench).
    let state = withPlayers(18);
    state = { ...state, numCourts: 2 };
    const uncapped = assignTeams(state, false); // 5v5 + 4v4, 0 sitting
    expect(countByStatus(uncapped).team).toBe(18);

    const cappedAfter = assignTeams({ ...uncapped, maxTeamSize: 4 }, false);
    expect(cappedAfter.players).toHaveLength(18); // nobody disappears
    expect(countByStatus(cappedAfter).team).toBe(16);
    expect(countByStatus(cappedAfter).sitting).toBe(2);
    expect(cappedAfter.sittingOrder).toHaveLength(2);
    // Every team's slots array should only reference players 1:1, no stale
    // out-of-range entries left over from the larger assignment.
    for (const court of cappedAfter.courts) {
      for (const teamId of [court.teamAId, court.teamBId]) {
        const filled = cappedAfter.teams[teamId].slots.filter((s) => s !== null);
        expect(filled.length).toBeLessThanOrEqual(court.sizePerTeam);
      }
    }
  });

  it('also fixes the shrink-after-the-fact case via Reshuffle Teams', () => {
    let state = withPlayers(18);
    state = { ...state, numCourts: 2 };
    const uncapped = assignTeams(state, false);
    const cappedAfter = reshuffleTeams({ ...uncapped, maxTeamSize: 4 });
    expect(cappedAfter.players).toHaveLength(18);
    expect(countByStatus(cappedAfter).team).toBe(16);
    expect(countByStatus(cappedAfter).sitting).toBe(2);
  });

  it('reshuffle keeps the same set of players active, just re-splits their teams', () => {
    const assigned = assignTeams(withPlayers(12), false);
    const activeBefore = new Set(assigned.players.filter((p) => p.status === 'team').map((p) => p.id));
    const sittingBefore = new Set(assigned.sittingOrder);

    const reshuffled = reshuffleTeams(assigned);
    const activeAfter = new Set(reshuffled.players.filter((p) => p.status === 'team').map((p) => p.id));
    const sittingAfter = new Set(reshuffled.sittingOrder);

    expect(activeAfter).toEqual(activeBefore);
    expect(sittingAfter).toEqual(sittingBefore);
  });

  it('leaves inactive courts (beyond numCourts) with no active team slots', () => {
    const state = assignTeams(withPlayers(10), false);
    const court2 = state.courts.find((c) => c.index === 2)!;
    expect(court2.active).toBe(false);
    expect(court2.sizePerTeam).toBe(0);
  });
});
