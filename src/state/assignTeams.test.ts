import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, reshuffleTeams } from './gameLogic';
import type { GameState } from '../types';

// Pinned to numCourts: 1 (rather than relying on the app's default) since
// several tests are built around single-court distribution math (10
// players -> 5v5, 12 players -> 5v5 + 2 sitting). Tests that specifically
// exercise multiple courts override numCourts explicitly.
function withPlayers(count: number, state: GameState = { ...createInitialState(), numCourts: 1 }): GameState {
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

  it('when a team shrinks, benches whoever has sat the least first - not whoever happens to be re-benched already', () => {
    // Regression test for the reported bug: cap -> uncap -> re-cap with 18
    // players re-benched the same two players who'd already sat in round 1.
    // Root cause: when the cap was removed, the fill loop naturally slotted
    // the just-benched players into the newly-opened team slots; when the
    // cap came back, truncating by raw slot position cut off exactly those
    // slots again, undoing their fair rotation. Truncation must be
    // fairness-aware: never re-bench an already-sat player while a
    // never-sat player remains on the same team.
    let state = withPlayers(18);
    state = { ...state, numCourts: 2, maxTeamSize: 4 };

    const round1 = assignTeams(state, false); // capped: 16 play, 2 sit
    const round1Sitters = new Set(round1.sittingOrder);
    expect(round1Sitters.size).toBe(2);

    const round2 = assignTeams({ ...round1, maxTeamSize: null }, false); // uncapped: everyone plays
    expect(countByStatus(round2).sitting ?? 0).toBe(0);

    const round3 = assignTeams({ ...round2, maxTeamSize: 4 }, false); // re-capped
    expect(round3.players).toHaveLength(18);
    expect(countByStatus(round3).team).toBe(16);
    expect(countByStatus(round3).sitting).toBe(2);

    // The players who already sat in round 1 (and were fairly rotated back
    // in during round 2) must not be the ones sent right back to the bench.
    const round3Sitters = new Set(round3.sittingOrder);
    for (const id of round1Sitters) {
      expect(round3Sitters.has(id)).toBe(false);
    }
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

  it('always picks the more-sat-out candidate over one with fewer sits', () => {
    // The fairness ranking sorts by sitCount before ever shuffling, so a
    // player who's sat far more than another should win the one open slot
    // deterministically, not just on average.
    let state = withPlayers(7); // 1 court, 3v3 (soloCourtSize(7) === 3)
    const [p1, p2, p3, p4, p5, wellRested, dueForAges] = state.players;
    const teamAId = 'team-1';
    const teamBId = 'team-2';
    state = {
      ...state,
      teams: {
        ...state.teams,
        [teamAId]: { ...state.teams[teamAId], slots: [p1.id, p2.id, p3.id, null, null] },
        [teamBId]: { ...state.teams[teamBId], slots: [p4.id, p5.id, null, null, null] },
      },
      players: state.players.map((p) => {
        if (p.id === p1.id || p.id === p2.id || p.id === p3.id) return { ...p, status: 'team', teamId: teamAId };
        if (p.id === p4.id || p.id === p5.id) return { ...p, status: 'team', teamId: teamBId };
        if (p.id === wellRested.id) return { ...p, status: 'sitting', sitCount: 0 };
        if (p.id === dueForAges.id) return { ...p, status: 'sitting', sitCount: 10 };
        return p;
      }),
    };

    const result = assignTeams(state, false);
    const teamBSlots = result.teams[teamBId].slots;
    expect(teamBSlots).toContain(dueForAges.id);
    expect(teamBSlots).not.toContain(wellRested.id);
  });

  it('never displaces a player who is already on a team, even a bare assignTeams call with partial teams', () => {
    // assignTeams only ever fills genuinely open slots - it must not treat
    // already-'team' players as contested just because no winner/promotion
    // has protected them yet (that contested-incumbent behavior belongs to
    // updateWins alone, after a round has actually been played).
    let state = withPlayers(7);
    const [p1, p2, p3, p4, p5] = state.players;
    state = {
      ...state,
      teams: {
        ...state.teams,
        'team-1': { ...state.teams['team-1'], slots: [p1.id, p2.id, p3.id, null, null] },
        'team-2': { ...state.teams['team-2'], slots: [p4.id, p5.id, null, null, null] },
      },
      players: state.players.map((p) =>
        [p1.id, p2.id, p3.id].includes(p.id)
          ? { ...p, status: 'team', teamId: 'team-1' }
          : [p4.id, p5.id].includes(p.id)
            ? { ...p, status: 'team', teamId: 'team-2' }
            : p,
      ),
    };

    const result = assignTeams(state, false);
    for (const id of [p1.id, p2.id, p3.id]) expect(result.teams['team-1'].slots).toContain(id);
    for (const id of [p4.id, p5.id]) expect(result.teams['team-2'].slots).toContain(id);
  });
});
