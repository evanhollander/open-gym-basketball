import { useState } from 'react';
import { useGameDispatch, useGameState } from '../state/context';

// Pre-drag-and-drop controls (M3) - dropdowns instead of the original's
// "type a player number into a box" inputs. Drag-and-drop (M4) is now the
// primary way to move players; this panel is a fallback for anyone who
// can't drag (accessibility, or just prefers it), so it's collapsed by
// default - on a phone, Courts + Bench should be the first thing visible
// after Assign Teams, not this.
export function ManualControls() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [sitId, setSitId] = useState('');
  const [swapOutId, setSwapOutId] = useState('');
  const [swapInId, setSwapInId] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (state.round === 0) return null;

  if (!expanded) {
    return (
      <div className="mx-auto mt-4 max-w-md text-center">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-blue-700 underline dark:text-blue-400"
        >
          Sit / swap a player manually
        </button>
      </div>
    );
  }

  const onTeam = state.players.filter((p) => p.status === 'team');

  function sit() {
    if (!sitId) return;
    dispatch({ type: 'SIT_PLAYER', playerId: sitId });
    setSitId('');
  }

  function swap() {
    if (!swapOutId || !swapInId) return;
    dispatch({ type: 'SWAP_PLAYERS', playerAId: swapOutId, playerBId: swapInId });
    setSwapOutId('');
    setSwapInId('');
  }

  return (
    <div className="mx-auto mt-4 flex max-w-md flex-col gap-3 rounded border border-gray-300 p-3 dark:border-gray-600">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="self-end text-sm text-blue-700 underline dark:text-blue-400"
      >
        Hide
      </button>
      <div className="flex items-center gap-2">
        <label htmlFor="sitPlayer" className="shrink-0">
          Sit Player:
        </label>
        <select
          id="sitPlayer"
          value={sitId}
          onChange={(e) => setSitId(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">-select-</option>
          {onTeam.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={sit}
          className="shrink-0 rounded border border-gray-400 px-3 py-1 active:bg-gray-100 dark:border-gray-500 dark:active:bg-gray-800"
        >
          Sit Out
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="swapOut" className="shrink-0">
          Swap:
        </label>
        <select
          id="swapOut"
          value={swapOutId}
          onChange={(e) => setSwapOutId(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">-player A-</option>
          {state.players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === swapInId}>
              {p.name}
            </option>
          ))}
        </select>
        <span>with</span>
        <select
          id="swapIn"
          value={swapInId}
          onChange={(e) => setSwapInId(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">-player B-</option>
          {state.players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === swapOutId}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={swap}
          className="shrink-0 rounded border border-gray-400 px-3 py-1 active:bg-gray-100 dark:border-gray-500 dark:active:bg-gray-800"
        >
          Swap
        </button>
      </div>
    </div>
  );
}
