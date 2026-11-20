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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-sm border-2 border-line-400/50 bg-line-500/10 px-3 py-2 text-sm text-line-900 dark:border-line-500/60 dark:bg-line-900/40 dark:text-line-400">
      <div>
        <p>
          The roster can now support a bigger game ({growth.newCapacity} players instead of {growth.currentCapacity}).
          Fill the new spots from the bench?
        </p>
        {/* Update Teams applies immediately, even onto a court that's mid-
            game (it can pull an already-playing player to make room, not
            just fill empty seats - see growTeams). Spelled out here rather
            than left implicit, since tapping it mid-possession is the one
            surprising case - waiting until Submit Winners needs no special
            handling from growTeams itself, the notice just stays up
            unconsumed until it's acted on. */}
        <p className="mt-0.5 text-xs text-line-900/70 dark:text-line-400/70">
          This applies right away, even mid-game. To wait until this game ends, submit the winners first, then tap
          Update Teams.
        </p>
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: 'GROW_TEAMS' })}
        className="shrink-0 rounded-sm bg-line-500 px-3 py-1 font-display font-medium tracking-wide text-white active:bg-line-600"
      >
        Update Teams
      </button>
    </div>
  );
}
