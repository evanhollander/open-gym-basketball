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
        'rounded-sm border-2 border-dashed bg-plank-50/60 p-3 transition-colors sm:p-4 lg:p-5 dark:bg-ink-800/40 ' +
        (selectedPlayerId ? 'border-line-400 dark:border-line-500' : 'border-plank-300 dark:border-ink-600')
      }
    >
      <h2 className="mb-2 text-center font-display text-lg font-semibold tracking-wide text-ink-800 sm:text-xl dark:text-plank-50">
        Bench
      </h2>
      {/* Each player was a full-width bar with most of the row empty once
          the bench had more than a couple people on a desktop/Chromebook
          screen - flow into columns there the same way the roster list
          does (see RosterPanel.tsx), instead of always stacking single-file. */}
      <div className="grid grid-cols-1 gap-1 sm:gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {benchPlayers.map((p) => (
          <PlayerCard key={p.id} player={p} target={target} />
        ))}
        {benchPlayers.length === 0 && (
          <p className="py-2 text-center text-sm text-ink-700/70 sm:text-base md:col-span-2 lg:col-span-3 dark:text-plank-200/70">
            {selectedPlayerId ? 'Tap here to bench the selected player.' : 'Nobody sitting - tap a player, then tap here to bench them.'}
          </p>
        )}
      </div>
    </div>
  );
}
