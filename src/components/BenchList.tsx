import { useGameState } from '../state/context';
import { getPlayer } from '../state/gameLogic';
import { useTileSelection } from './TileSelection';
import type { DropTarget } from '../types';
import { PlayerCard } from './PlayerCard';

export function BenchList() {
  const state = useGameState();
  const benchPlayers = state.sittingOrder.map((id) => getPlayer(state, id)).filter((p) => p !== undefined);
  const { selectedPlayerId, onTileClick } = useTileSelection();
  const target: DropTarget = { kind: 'bench' };

  return (
    <div
      onClick={(e) => {
        // Tapping anywhere in the bench area - including on top of another
        // bench player's own card, which stops its own click here first -
        // benches the selected player, same as the old drag-onto-bench-
        // region behavior. It doesn't swap with whichever card was tapped.
        e.stopPropagation();
        onTileClick(null, target);
      }}
      className={
        'rounded border p-3 transition-colors sm:p-4 lg:p-5 ' +
        (selectedPlayerId ? 'border-blue-400 dark:border-blue-600' : 'border-gray-300 dark:border-gray-600')
      }
    >
      <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">Bench</h2>
      {/* Each player was a full-width bar with most of the row empty once
          the bench had more than a couple people on a desktop/Chromebook
          screen - flow into columns there the same way the roster list
          does (see RosterPanel.tsx), instead of always stacking single-file. */}
      <div className="grid grid-cols-1 gap-1 sm:gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {benchPlayers.map((p) => (
          <PlayerCard key={p.id} player={p} target={target} />
        ))}
        {benchPlayers.length === 0 && (
          <p className="py-2 text-center text-sm text-gray-500 sm:text-base md:col-span-2 lg:col-span-3 dark:text-gray-400">
            {selectedPlayerId ? 'Tap here to bench the selected player.' : 'Nobody sitting - tap a player, then tap here to bench them.'}
          </p>
        )}
      </div>
    </div>
  );
}
