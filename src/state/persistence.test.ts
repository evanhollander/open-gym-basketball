import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadState, saveState } from './persistence';
import { createInitialState } from './initialState';

// Node 25's own built-in `localStorage` global (a stub, since it's missing
// `.clear()` without a `--localstorage-file` path configured) takes
// precedence over jsdom's in this test environment, and persistence.ts
// intentionally reads/writes the bare `localStorage` global to match real
// browser code. Stub a real in-memory implementation for the duration of
// these tests rather than relying on whichever ambient global wins.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe('loadState', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('returns null when nothing has been saved', () => {
    expect(loadState()).toBeNull();
  });

  it('round-trips a full save unchanged', () => {
    const state = { ...createInitialState(), maxSingleCourtPlayers: 9 };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('backfills a field missing from an older save with its current default', () => {
    // Regression: a save from before maxSingleCourtPlayers existed parses
    // back with that key simply absent (undefined), not 13. That broke
    // `players > maxSingleCourtPlayers` (always false against undefined),
    // permanently locking a returning user's 2nd court off regardless of
    // player count - loadState must backfill any field an older save
    // predates against today's defaults, without touching fields the save
    // actually has.
    const oldSave = createInitialState() as unknown as Record<string, unknown>;
    delete oldSave.maxSingleCourtPlayers;
    delete oldSave.theme;
    localStorage.setItem('open-gym:v1', JSON.stringify(oldSave));

    const loaded = loadState();
    expect(loaded?.maxSingleCourtPlayers).toBe(13);
    expect(loaded?.theme).toBe('system');
  });

  it('backfills wins: 0 on each individual player from an older save, not just top-level fields', () => {
    // Regression: the top-level `{ ...createInitialState(), ...saved }`
    // spread only backfills missing GameState keys - it can't reach inside
    // each element of the players array, so a save from before Player.wins
    // existed parses back with every player object simply missing that key.
    // Left unhandled, `p.wins + 1` in updateWins would silently produce NaN
    // for a returning user's entire roster.
    const oldSave = createInitialState() as unknown as Record<string, unknown>;
    oldSave.players = [
      { id: 'p1', name: 'Alex', status: 'none', teamId: null, sitCount: 0, statusRound: 0 },
    ];
    localStorage.setItem('open-gym:v1', JSON.stringify(oldSave));

    const loaded = loadState();
    expect(loaded?.players[0].wins).toBe(0);
  });

  it('still preserves an explicitly saved value, including falsy-looking ones', () => {
    const state = { ...createInitialState(), round: 0, maxTeamSize: null };
    saveState(state);
    const loaded = loadState();
    expect(loaded?.round).toBe(0);
    expect(loaded?.maxTeamSize).toBeNull();
  });
});
