import { describe, expect, it } from 'vitest';
import { distributePlayers } from './gameLogic';

// Matches the app's default maxSingleCourtPlayers (see initialState.ts) -
// used everywhere below except the tests specifically exercising that
// setting, so distributePlayers' signature change doesn't ripple through
// every unrelated test.
const DEFAULT_MAX_SINGLE_COURT = 13;

describe('distributePlayers - single court', () => {
  it('defaults to 5v5', () => {
    expect(distributePlayers(1, 10, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 5 });
  });
  it('drops to 3v3 for 6-7 players', () => {
    expect(distributePlayers(1, 6, 3, null, DEFAULT_MAX_SINGLE_COURT).court1).toBe(3);
    expect(distributePlayers(1, 7, 3, null, DEFAULT_MAX_SINGLE_COURT).court1).toBe(3);
  });
  it('drops to 4v4 for 8-9 players', () => {
    expect(distributePlayers(1, 8, 3, null, DEFAULT_MAX_SINGLE_COURT).court1).toBe(4);
    expect(distributePlayers(1, 9, 3, null, DEFAULT_MAX_SINGLE_COURT).court1).toBe(4);
  });
});

describe('distributePlayers - two courts, gameType 3 (default)', () => {
  it('stays single-court through 13 players even with a 2nd court available - splitting into two 3v3s is worse than one fuller game', () => {
    for (const players of [11, 12, 13]) {
      expect(distributePlayers(2, players, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({
        court1: 5,
        court2: 0,
      });
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
    expect(distributePlayers(2, players, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1, court2 });
  });
});

describe('distributePlayers - Max Players on 1 Court setting', () => {
  it('lowering to 11 opens a real 3v3 + 3v3 split at 12 players (the true minimum for two 3v3 courts)', () => {
    // maxSingleCourtPlayers=12 means 12 itself still stays single-court
    // (it's the max *allowed* on one court); 11 is what makes 12 the first
    // player count that splits.
    expect(distributePlayers(2, 12, 3, null, 12)).toMatchObject({ court1: 5, court2: 0 });
    expect(distributePlayers(2, 12, 3, null, 11)).toMatchObject({ court1: 3, court2: 3 });
    expect(distributePlayers(2, 13, 3, null, 11)).toMatchObject({ court1: 3, court2: 3 });
  });
  it('lowering below 12 has no further effect - not enough players for two valid 3v3 courts regardless of the setting', () => {
    expect(distributePlayers(2, 10, 3, null, 4)).toMatchObject({ court1: 5, court2: 0 });
    expect(distributePlayers(2, 11, 3, null, 4)).toMatchObject({ court1: 5, court2: 0 });
  });
  it('a higher gameType minimum needs more players regardless of how low this setting goes', () => {
    // gameType 5 (5v5 minimum) needs 20 for two valid 5v5 courts - lowering
    // maxSingleCourtPlayers to the floor doesn't change that.
    expect(distributePlayers(2, 15, 5, null, 3)).toMatchObject({ court1: 5, court2: 0 });
  });
});

describe('distributePlayers - Court 2 stays off below the 2-court threshold regardless of small-group solo shrinking', () => {
  it('a small group with 2 courts available still shrinks Court 1 (not stuck at 5v5 target)', () => {
    // Regression: Court 1 must fall back to the same solo-court sizing
    // when Court 2 isn't warranted yet, even if numCourts allows for 2 -
    // otherwise a 6-person group with 2 courts available would target a
    // 5v5 (only 6 people to fill 10 slots) instead of a proper 3v3.
    expect(distributePlayers(2, 6, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 3, court2: 0 });
    expect(distributePlayers(2, 8, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 4, court2: 0 });
  });
});

describe('distributePlayers - two courts, gameType 4 (boundary fix)', () => {
  it('opens Court 2 at exactly 18 players (original had an off-by-one here)', () => {
    expect(distributePlayers(2, 18, 4, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 5, court2: 4 });
  });
  it('court1 stays a full 5v5 through the 18-19 band since only Court 2 shrinks', () => {
    expect(distributePlayers(2, 19, 4, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 5, court2: 4 });
  });
  it('both courts run 4v4 for 16-17 players', () => {
    expect(distributePlayers(2, 16, 4, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 4, court2: 4 });
  });
});

describe('distributePlayers - third and fourth courts', () => {
  it('opens Court 3 once player count passes the thresholds', () => {
    expect(distributePlayers(3, 26, 3, null, DEFAULT_MAX_SINGLE_COURT).court3).toBe(3);
    expect(distributePlayers(3, 28, 3, null, DEFAULT_MAX_SINGLE_COURT).court3).toBe(4);
    expect(distributePlayers(3, 30, 3, null, DEFAULT_MAX_SINGLE_COURT).court3).toBe(5);
  });
  it('opens Court 4 once player count passes the thresholds', () => {
    expect(distributePlayers(4, 36, 3, null, DEFAULT_MAX_SINGLE_COURT).court4).toBe(3);
    expect(distributePlayers(4, 38, 3, null, DEFAULT_MAX_SINGLE_COURT).court4).toBe(4);
    expect(distributePlayers(4, 40, 3, null, DEFAULT_MAX_SINGLE_COURT).court4).toBe(5);
  });
});

describe('distributePlayers - Max Team Size cap', () => {
  it('clamps every active court down to the cap, leaving the rest to sit', () => {
    // 18 players, 2 courts, 3v3 minimum: uncapped is (5, 4) = everyone plays.
    expect(distributePlayers(2, 18, 3, null, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 5, court2: 4 });
    // Capped at 4v4: both courts clamp to 4, 2 players end up on the bench.
    expect(distributePlayers(2, 18, 3, 4, DEFAULT_MAX_SINGLE_COURT)).toMatchObject({ court1: 4, court2: 4 });
  });
  it('never raises a court above its uncapped size', () => {
    expect(distributePlayers(1, 6, 3, 5, DEFAULT_MAX_SINGLE_COURT).court1).toBe(3);
  });
});
