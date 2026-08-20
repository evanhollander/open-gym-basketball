import { useDraggable } from '@dnd-kit/core';
import type { Player } from '../types';

/** A single player, shown on a team slot or the bench. Draggable to any
 * open team slot or the bench - see RotationBoard.tsx for the DndContext
 * that makes this work, and dragDrop.ts for how a drop gets turned into a
 * MOVE_PLAYER action.
 *
 * `isDue`, set only by BenchList, highlights bench players who've sat
 * enough rounds to be first in line for the next opening - the same
 * `sitCount >= maxSit` threshold the fairness shuffle itself uses (see
 * buildDueTierPool in gameLogic.ts), surfaced here as a pure read rather
 * than a stored status. (An earlier version of this component color-coded
 * the 'holding'/'pending' player statuses, but those only ever exist
 * mid-computation inside assignTeams/updateWins - both functions sweep
 * every non-'team' player back to 'sitting' before returning, so no
 * rendered state can ever actually have one. Removed rather than ship
 * styling for a case that can't happen.) */
export function PlayerCard({ player, isDue }: { player: Player; isDue?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      // touch-none stops the browser's own scroll gesture from fighting the
      // TouchSensor's drag recognition on phones. pr-6 leaves room for the
      // sit-count badge so long names ellipsis before running under it.
      // focus-visible ring is the keyboard-drag entry point's only visual
      // cue (dnd-kit's KeyboardSensor drags via Tab + Space/arrows/Space).
      className={
        'relative touch-none select-none rounded px-2 py-1.5 pr-6 text-sm shadow-sm ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ' +
        (isDue
          ? 'bg-blue-50 ring-blue-300 dark:bg-blue-950 dark:ring-blue-800'
          : 'bg-white ring-gray-200 dark:bg-gray-800 dark:ring-gray-700') +
        ' ' +
        (isDragging ? 'opacity-30' : 'cursor-grab active:cursor-grabbing')
      }
    >
      <span className="block truncate">
        {player.name}
        {isDue && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">next up</span>}
      </span>
      <span
        title={`Sat out ${player.sitCount} time${player.sitCount === 1 ? '' : 's'}`}
        className="absolute bottom-0.5 right-1.5 text-[10px] leading-none text-gray-400 dark:text-gray-500"
      >
        {player.sitCount}
      </span>
    </div>
  );
}
