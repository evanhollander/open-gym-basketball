import { useGameDispatch, useGameState } from '../state/context';
import { courtGrowthAvailable } from '../state/gameLogic';

/**
 * Purely reactive, same pattern as FairnessNotice - no dismissed flag
 * stored anywhere. Only shows while courtGrowthAvailable(state) actually
 * finds spare capacity, so clicking Update Teams (which fills the new
 * slots via growTeams) makes it disappear on its own once there's nothing
 * left to grow into.
 */
export function GrowthNotice() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const growth = courtGrowthAvailable(state);
  if (!growth) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
      <p>
        The roster can now support a bigger game ({growth.newCapacity} players instead of {growth.currentCapacity}).
        Fill the new spots from the bench?
      </p>
      <button
        type="button"
        onClick={() => dispatch({ type: 'GROW_TEAMS' })}
        className="shrink-0 rounded bg-blue-600 px-3 py-1 font-medium text-white active:bg-blue-700"
      >
        Update Teams
      </button>
    </div>
  );
}
