import { useState } from 'react';
import { useGameDispatch, useGameState } from '../state/context';

// Temporary pre-drag-and-drop controls (M3) - dropdowns instead of the
// original's "type a player number into a box" inputs, since we have real
// player objects to pick names from. M4 replaces this panel with drag-and-drop
// player cards, reusing the same sitPlayer/swapPlayers logic underneath.
export function ManualControls() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [sitId, setSitId] = useState('');
  const [swapOutId, setSwapOutId] = useState('');
  const [swapInId, setSwapInId] = useState('');

  if (state.round === 0) return null;

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
