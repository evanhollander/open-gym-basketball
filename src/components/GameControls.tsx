import { useGameDispatch, useGameState } from '../state/context';

export function GameControls() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  // A round is "in progress" whenever someone is actually on a team right
  // now - not just `round > 0`, since Clear Teams can wipe every team back
  // to empty without resetting the round counter. Assign Teams starts a
  // fresh round (advances the round, counts a sit for whoever ends up on
  // the bench) so it's only shown when there's nothing assigned yet;
  // Reshuffle Teams re-scrambles the *current* round's teams without any
  // of that counting, so it only makes sense once a round exists. Matches
  // the original app, which hid its "Assign Teams" button entirely once a
  // round started - keeping both buttons on screen at all times invited
  // clicking "Assign Teams" again mid-round expecting a free reshuffle,
  // which instead silently started a new round and bumped sit counts.
  const roundInProgress = state.players.some((p) => p.status === 'team');

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {roundInProgress ? (
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESHUFFLE_TEAMS' })}
          className="rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
        >
          Reshuffle Teams
        </button>
      ) : (
        <button
          type="button"
          onClick={() => dispatch({ type: 'ASSIGN_TEAMS' })}
          className="rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
        >
          Assign Teams
        </button>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: 'CLEAR_TEAMS' })}
        className="rounded border border-gray-400 px-4 py-2 active:bg-gray-100 dark:border-gray-500 dark:active:bg-gray-800"
      >
        Clear Teams
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'CLEAR_SAT' })}
        className="rounded border border-gray-400 px-4 py-2 active:bg-gray-100 dark:border-gray-500 dark:active:bg-gray-800"
      >
        Clear # Games Sat
      </button>
      {state.lastError && (
        <p className="w-full rounded bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.lastError}
        </p>
      )}
      {state.lastNotice && (
        <p className="w-full rounded bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {state.lastNotice}
        </p>
      )}
    </div>
  );
}
