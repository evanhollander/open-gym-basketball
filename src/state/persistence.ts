// The original saved every field individually to localStorage (num_players,
// name17, sit-3, ...) and re-read each one by hand on load. Since our whole
// app is one GameState object, we can just save/load it as one JSON blob.
import type { GameState } from '../types';
import { createInitialState } from './initialState';

const STORAGE_KEY = 'open-gym:v1';

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail (private browsing, quota) - losing persistence isn't
    // worth crashing the app over.
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<GameState>;
    // A save from before some GameState field existed (e.g.
    // maxSingleCourtPlayers, theme) parses back with that key simply
    // missing, not merely falsy - `undefined` rather than a real number or
    // string. That silently broke comparisons like `players >
    // maxSingleCourtPlayers` (always false against undefined), locking
    // long-time users out of the 2nd-court split no matter their player
    // count. Spreading onto today's defaults backfills any field a saved
    // blob predates, while every field the save actually has (including an
    // empty players array) still wins since it comes second.
    //
    // That top-level spread does NOT reach inside each element of the
    // players array, though - a save from before Player.wins existed parses
    // back with individual player objects simply missing that key, which
    // would make `p.wins + 1` in updateWins silently produce NaN forever
    // for a returning user's whole roster. Each player needs its own
    // default-then-override backfill for the same reason.
    const players = (saved.players ?? []).map((p) => ({ ...p, wins: p.wins ?? 0 }));
    return { ...createInitialState(), ...saved, players };
  } catch {
    return null;
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
