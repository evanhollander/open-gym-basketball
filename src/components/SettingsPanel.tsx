import { useGameDispatch, useGameState } from '../state/context';
import type { GameType } from '../types';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 2, label: '2 v 2' },
  { value: 3, label: '3 v 3' },
  { value: 4, label: '4 v 4' },
  { value: 5, label: '5 v 5' },
];

export function SettingsPanel() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div>
        <label htmlFor="gameType" className="mb-1 block font-medium">
          Minimum Game
        </label>
        <select
          id="gameType"
          value={state.gameType}
          onChange={(e) => dispatch({ type: 'SET_GAME_TYPE', gameType: Number(e.target.value) as GameType })}
          className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          {GAME_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Determines the minimum game format.</p>
      </div>

      <div>
        <label htmlFor="maxTeamSize" className="mb-1 block font-medium">
          Max Team Size
        </label>
        <select
          id="maxTeamSize"
          value={state.maxTeamSize ?? 'none'}
          onChange={(e) =>
            dispatch({
              type: 'SET_MAX_TEAM_SIZE',
              maxTeamSize: e.target.value === 'none' ? null : (Number(e.target.value) as GameType),
            })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="none">No cap (fit as many players as possible)</option>
          {GAME_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Cap at {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Caps players-per-team so a court never grows bigger than this, even if there are enough players -
          extra players sit and rotate in instead.
        </p>
      </div>

      <div>
        <label htmlFor="numCourts" className="mb-1 block font-medium">
          Number of Courts
        </label>
        {/* A free-text number input misbehaves on mobile: tapping doesn't
            select the existing digit, so typing "2" while it shows "1"
            produces "12" before clamping, which always clamps to the max
            (4). A fixed 1-4 range has no reason to be free text anyway. */}
        <select
          id="numCourts"
          value={state.numCourts}
          onChange={(e) =>
            dispatch({ type: 'SET_NUM_COURTS', numCourts: Number(e.target.value) as 1 | 2 | 3 | 4 })
          }
          className="w-24 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Supports up to 4 courts.</p>
      </div>

      <div>
        <label htmlFor="maxConsecutiveWins" className="mb-1 block font-medium">
          Winner Stays On (max consecutive wins)
        </label>
        <select
          id="maxConsecutiveWins"
          value={state.maxConsecutiveWins}
          onChange={(e) => dispatch({ type: 'SET_MAX_CONSECUTIVE_WINS', value: Number(e.target.value) })}
          className="w-24 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Court 1's winning team is benched once it wins this many games in a row, even though it won -
          keeps one team from holding the main court all night.
        </p>
      </div>

      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Remove every player and reset all settings? This cannot be undone.')) {
              dispatch({ type: 'RESET_ALL' });
            }
          }}
          className="w-full rounded border border-red-300 px-4 py-2 text-red-700 active:bg-red-50 dark:border-red-800 dark:text-red-400 dark:active:bg-red-950"
        >
          Reset Everything
        </button>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Removes every player and resets rounds, sit counts, and win streaks. Settings above stay as-is.
        </p>
      </div>
    </section>
  );
}
