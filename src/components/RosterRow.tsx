import { useGameDispatch } from '../state/context';
import type { Player } from '../types';

const STATUS_LABEL: Record<Player['status'], string> = {
  none: 'Not yet played',
  team: 'Playing',
  sitting: 'Sitting',
};

// Playing/Sitting/Not-yet-played previously rendered as identical gray
// text, so spotting who's actually sitting meant reading every row - a dot
// colored by status lets that happen at a glance instead.
const STATUS_DOT: Record<Player['status'], string> = {
  none: 'bg-gray-300 dark:bg-gray-600',
  team: 'bg-green-500 dark:bg-green-400',
  sitting: 'bg-amber-500 dark:bg-amber-400',
};

export function RosterRow({ player }: { player: Player }) {
  const dispatch = useGameDispatch();

  return (
    <li className="flex items-center justify-between gap-3 border-b border-gray-200 py-2 dark:border-gray-700">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          <span className={'inline-block h-2.5 w-2.5 shrink-0 rounded-full ' + STATUS_DOT[player.status]} />
          {player.name}
        </p>
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
