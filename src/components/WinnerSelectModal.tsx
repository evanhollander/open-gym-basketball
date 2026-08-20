import { useState } from 'react';
import { useGameDispatch, useGameState } from '../state/context';
import { getActiveCourts, getTeam } from '../state/gameLogic';

/** Per-court winner picker + "Submit Winners" - shown once a round is
 * underway. Not a true modal dialog (kept as an inline panel, consistent
 * with "favor fewer, flatter files" - see OPEN_GYM_LOGIC.md's port plan),
 * named to match the legacy "Select Winning Team(s)" panel it replaces. */
export function WinnerSelectModal() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [winners, setWinners] = useState<Record<string, string>>({});

  if (state.round === 0) return null;
  const activeCourts = getActiveCourts(state);

  function teamLabel(teamId: string) {
    const team = getTeam(state, teamId)!;
    return `Team ${teamId.split('-')[1]} (${team.side === 'white' ? 'White' : 'Dark'})`;
  }

  function submit() {
    dispatch({ type: 'SUBMIT_WINNERS', winners });
    setWinners({});
  }

  return (
    <div className="mx-auto mt-4 flex max-w-md flex-col gap-2 rounded border border-gray-300 p-3 dark:border-gray-600">
      <h3 className="text-center font-semibold">Select Winning Team(s)</h3>
      {activeCourts.map((court) => (
        <label key={court.id} className="flex items-center justify-between gap-2">
          <span>Court {court.index}</span>
          <select
            value={winners[court.id] ?? ''}
            onChange={(e) => setWinners((prev) => ({ ...prev, [court.id]: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">-select winner-</option>
            <option value={court.teamAId}>{teamLabel(court.teamAId)}</option>
            <option value={court.teamBId}>{teamLabel(court.teamBId)}</option>
          </select>
        </label>
      ))}
      <button
        type="button"
        onClick={submit}
        className="mt-1 rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
      >
        Submit Winners / Next Game
      </button>
    </div>
  );
}
