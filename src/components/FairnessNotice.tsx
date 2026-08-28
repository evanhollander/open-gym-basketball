import { useGameDispatch, useGameState } from '../state/context';
import { findUnfairSecondSit, getPlayer } from '../state/gameLogic';

/**
 * Purely reactive - there's no dismissed flag stored anywhere. The banner
 * only shows while findUnfairSecondSit(state) actually finds a pair, so
 * clicking Auto-balance (which fixes the pair via a swap) or manually
 * dragging either player yourself both make it disappear on their own, no
 * separate "dismiss" bookkeeping required.
 */
export function FairnessNotice() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const unfairPair = findUnfairSecondSit(state);
  if (!unfairPair) return null;

  const repeatSitter = getPlayer(state, unfairPair.repeatSitterId);
  const neverSatPlayer = getPlayer(state, unfairPair.neverSatPlayerId);
  if (!repeatSitter || !neverSatPlayer) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>
        <strong>{repeatSitter.name}</strong> is sitting again while <strong>{neverSatPlayer.name}</strong> hasn't
        sat at all yet. Swap them, or handle it yourself with drag-and-drop.
      </p>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: 'SWAP_PLAYERS', playerAId: unfairPair.repeatSitterId, playerBId: unfairPair.neverSatPlayerId })
        }
        className="shrink-0 rounded bg-amber-600 px-3 py-1 font-medium text-white active:bg-amber-700"
      >
        Auto-balance
      </button>
    </div>
  );
}
