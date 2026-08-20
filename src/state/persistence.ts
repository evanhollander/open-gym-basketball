// The original saved every field individually to localStorage (num_players,
// name17, sit-3, ...) and re-read each one by hand on load. Since our whole
// app is one GameState object, we can just save/load it as one JSON blob.
import type { GameState } from '../types';

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
    return JSON.parse(raw) as GameState;
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
