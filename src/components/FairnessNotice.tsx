import { useGameDispatch, useGameState } from '../state/context';
import { findLopsidedSitGap, getPlayer } from '../state/gameLogic';

/**
 * Purely reactive - there's no dismissed flag stored anywhere. The banner
 * only shows while findLopsidedSitGap(state) actually finds a pair, so
 * clicking Auto-balance (which fixes the pair via a swap) or manually
 * moving either player yourself both make it disappear on their own, no
 * separate "dismiss" bookkeeping required.
 */
export function FairnessNotice() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const lopsidedPair = findLopsidedSitGap(state);
  if (!lopsidedPair) return null;

  const overSatPlayer = getPlayer(state, lopsidedPair.overSatPlayerId);
  const underSatPlayer = getPlayer(state, lopsidedPair.underSatPlayerId);
  if (!overSatPlayer || !underSatPlayer) return null;

  const gap = overSatPlayer.sitCount - underSatPlayer.sitCount;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>
        <strong>{overSatPlayer.name}</strong> has sat out {gap} more round{gap === 1 ? '' : 's'} than{' '}
        <strong>{underSatPlayer.name}</strong>, who's still playing. Swap them, or handle it yourself by tapping
        players.
      </p>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: 'SWAP_PLAYERS', playerAId: lopsidedPair.overSatPlayerId, playerBId: lopsidedPair.underSatPlayerId })
        }
        className="shrink-0 rounded bg-amber-600 px-3 py-1 font-medium text-white active:bg-amber-700"
      >
        Auto-balance
      </button>
    </div>
  );
}
