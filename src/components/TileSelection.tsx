import { createContext, useContext, type ReactNode } from 'react';
import type { DropTarget } from '../types';

/**
 * Cross-cutting tap-to-select-then-tap-target state, shared by every
 * PlayerCard/TeamSlot/BenchList so RotationBoard doesn't have to drill
 * selectedPlayerId/onTileClick/etc. through CourtView -> TeamColumn ->
 * TeamSlot by hand. Same pattern as useGameState/useGameDispatch.
 */
export interface TileSelectionApi {
  selectedPlayerId: string | null;
  shakingPlayerId: string | null;
  /** Call with the player occupying the tapped tile (null for an empty team
   * slot or the bench background) and where that tile is. RotationBoard
   * decides whether this starts a selection, cancels one, or executes a
   * move based on its own selectedPlayerId. */
  onTileClick: (clickedPlayerId: string | null, target: DropTarget) => void;
  registerCardRef: (playerId: string, el: HTMLElement | null) => void;
}

const TileSelectionContext = createContext<TileSelectionApi | null>(null);

export function TileSelectionProvider({ value, children }: { value: TileSelectionApi; children: ReactNode }) {
  return <TileSelectionContext.Provider value={value}>{children}</TileSelectionContext.Provider>;
}

export function useTileSelection(): TileSelectionApi {
  const ctx = useContext(TileSelectionContext);
  if (!ctx) throw new Error('useTileSelection must be used within a TileSelectionProvider.');
  return ctx;
}
