import { describe, expect, it } from 'vitest';
import { distributePlayers } from './gameLogic';

describe('distributePlayers - single court', () => {
  it('defaults to 5v5', () => {
    expect(distributePlayers(1, 10, 3, null)).toMatchObject({ court1: 5 });
  });
  it('drops to 3v3 for 6-7 players', () => {
    expect(distributePlayers(1, 6, 3, null).court1).toBe(3);
    expect(distributePlayers(1, 7, 3, null).court1).toBe(3);
  });
  it('drops to 4v4 for 8-9 players', () => {
    expect(distributePlayers(1, 8, 3, null).court1).toBe(4);
    expect(distributePlayers(1, 9, 3, null).court1).toBe(4);
  });
});

describe('distributePlayers - two courts, gameType 3 (default)', () => {
  it('stays single-court through 13 players even with a 2nd court available - splitting into two 3v3s is worse than one fuller game', () => {
    for (const players of [11, 12, 13]) {
      expect(distributePlayers(2, players, 3, null)).toMatchObject({ court1: 5, court2: 0 });
    }
  });

  const cases: [number, number, number][] = [
    [14, 4, 3],
    [16, 4, 4],
    [18, 5, 4],
    [20, 5, 5],
    [25, 5, 5],
  ];
  it.each(cases)('%i players -> court1=%i, court2=%i', (players, court1, court2) => {
    expect(distributePlayers(2, players, 3, null)).toMatchObject({ court1, court2 });
  });
});

describe('distributePlayers - Court 2 stays off below the 2-court threshold regardless of small-group solo shrinking', () => {
  it('a small group with 2 courts available still shrinks Court 1 (not stuck at 5v5 target)', () => {
    // Regression: Court 1 must fall back to the same solo-court sizing
    // when Court 2 isn't warranted yet, even if numCourts allows for 2 -
    // otherwise a 6-person group with 2 courts available would target a
    // 5v5 (only 6 people to fill 10 slots) instead of a proper 3v3.
    expect(distributePlayers(2, 6, 3, null)).toMatchObject({ court1: 3, court2: 0 });
    expect(distributePlayers(2, 8, 3, null)).toMatchObject({ court1: 4, court2: 0 });
  });
});

describe('distributePlayers - two courts, gameType 4 (boundary fix)', () => {
  it('opens Court 2 at exactly 18 players (original had an off-by-one here)', () => {
    expect(distributePlayers(2, 18, 4, null)).toMatchObject({ court1: 5, court2: 4 });
  });
  it('court1 stays a full 5v5 through the 18-19 band since only Court 2 shrinks', () => {
    expect(distributePlayers(2, 19, 4, null)).toMatchObject({ court1: 5, court2: 4 });
  });
  it('both courts run 4v4 for 16-17 players', () => {
    expect(distributePlayers(2, 16, 4, null)).toMatchObject({ court1: 4, court2: 4 });
  });
});

describe('distributePlayers - third and fourth courts', () => {
  it('opens Court 3 once player count passes the thresholds', () => {
    expect(distributePlayers(3, 26, 3, null).court3).toBe(3);
    expect(distributePlayers(3, 28, 3, null).court3).toBe(4);
    expect(distributePlayers(3, 30, 3, null).court3).toBe(5);
  });
  it('opens Court 4 once player count passes the thresholds', () => {
    expect(distributePlayers(4, 36, 3, null).court4).toBe(3);
    expect(distributePlayers(4, 38, 3, null).court4).toBe(4);
    expect(distributePlayers(4, 40, 3, null).court4).toBe(5);
  });
});

describe('distributePlayers - Max Team Size cap', () => {
  it('clamps every active court down to the cap, leaving the rest to sit', () => {
    // 18 players, 2 courts, 3v3 minimum: uncapped is (5, 4) = everyone plays.
    expect(distributePlayers(2, 18, 3, null)).toMatchObject({ court1: 5, court2: 4 });
    // Capped at 4v4: both courts clamp to 4, 2 players end up on the bench.
    expect(distributePlayers(2, 18, 3, 4)).toMatchObject({ court1: 4, court2: 4 });
  });
  it('never raises a court above its uncapped size', () => {
    expect(distributePlayers(1, 6, 3, 5).court1).toBe(3);
  });
});
