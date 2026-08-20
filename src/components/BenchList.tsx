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
        'rounded border p-3 transition-colors ' +
        (isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-600')
      }
    >
      <h2 className="mb-2 text-center text-lg font-semibold">Bench</h2>
      <div className="flex flex-col gap-1">
        {benchPlayers.map((p) => (
          <PlayerCard key={p.id} player={p} isDue={p.sitCount >= state.maxSit} />
        ))}
        {benchPlayers.length === 0 && (
          <p className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Nobody sitting - drag a player here to bench them.
          </p>
        )}
      </div>
    </div>
  );
}
