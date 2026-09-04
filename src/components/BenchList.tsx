import { useDroppable } from '@dnd-kit/core';
import { useGameState } from '../state/context';
import { getPlayer } from '../state/gameLogic';
import type { DropTarget } from '../types';
import { PlayerCard } from './PlayerCard';

export function BenchList() {
  const state = useGameState();
  const benchPlayers = state.sittingOrder.map((id) => getPlayer(state, id)).filter((p) => p !== undefined);
  const dropTarget: DropTarget = { kind: 'bench' };
  const { setNodeRef, isOver } = useDroppable({ id: 'bench', data: dropTarget });

  return (
    <div
      ref={setNodeRef}
      className={
        'rounded border p-3 transition-colors sm:p-4 lg:p-5 ' +
        (isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-600')
      }
    >
      <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">Bench</h2>
      {/* Each player was a full-width bar with most of the row empty once
          the bench had more than a couple people on a desktop/Chromebook
          screen - flow into columns there the same way the roster list
          does (see RosterPanel.tsx), instead of always stacking single-file. */}
      <div className="grid grid-cols-1 gap-1 sm:gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {benchPlayers.map((p) => (
          <PlayerCard key={p.id} player={p} />
        ))}
        {benchPlayers.length === 0 && (
          <p className="py-2 text-center text-sm text-gray-500 sm:text-base md:col-span-2 lg:col-span-3 dark:text-gray-400">
            Nobody sitting - drag a player here to bench them.
          </p>
        )}
      </div>
    </div>
  );
}
