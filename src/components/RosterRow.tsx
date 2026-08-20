import { useGameDispatch } from '../state/context';
import type { Player } from '../types';

const STATUS_LABEL: Record<Player['status'], string> = {
  none: 'Not yet played',
  team: 'Playing',
  sitting: 'Sitting',
  next: 'Next up',
  holding: 'Holding',
  pending: 'Pending',
};

export function RosterRow({ player }: { player: Player }) {
  const dispatch = useGameDispatch();

  return (
    <li className="flex items-center justify-between gap-3 border-b border-gray-200 py-2 dark:border-gray-700">
      <div className="min-w-0">
        <p className="truncate font-medium">{player.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {STATUS_LABEL[player.status]} &middot; sat {player.sitCount}x
        </p>
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
        className="shrink-0 rounded border border-red-300 px-3 py-1 text-sm text-red-600 active:bg-red-50 dark:border-red-800 dark:text-red-400"
      >
        Remove
      </button>
    </li>
  );
}
