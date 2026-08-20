import { useGameDispatch, useGameState } from '../state/context';

export function GameControls() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={() => dispatch({ type: 'ASSIGN_TEAMS' })}
        className="rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
      >
        Assign Teams
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'RESHUFFLE_TEAMS' })}
        className="rounded border border-gray-400 px-4 py-2 active:bg-gray-100 dark:border-gray-500 dark:active:bg-gray-800"
      >
        Reshuffle Teams
      </button>
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
    </div>
  );
}
