import { useDraggable } from '@dnd-kit/core';
import type { Player } from '../types';

/** A single player, shown on a team slot or the bench. Draggable to any
 * open team slot or the bench - see RotationBoard.tsx for the DndContext
 * that makes this work, and dragDrop.ts for how a drop gets turned into a
 * MOVE_PLAYER action. */
export function PlayerCard({ player }: { player: Player }) {
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
        // Sized for a phone by default; sm:/lg: steps bump text and padding
        // up on tablet/desktop/Chromebook screens instead of leaving a
        // phone-sized card centered in a bunch of unused space.
        'relative touch-none select-none rounded px-2 py-1.5 pr-6 text-sm shadow-sm ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:px-3 sm:py-2 sm:pr-8 bg-white ring-gray-200 dark:bg-gray-800 dark:ring-gray-700 ' +
        (isDragging ? 'opacity-30' : 'cursor-grab active:cursor-grabbing')
      }
    >
      <span className="block truncate text-base font-semibold sm:text-lg">{player.name}</span>
      <span
        title={`Sat out ${player.sitCount} time${player.sitCount === 1 ? '' : 's'}`}
        className="absolute bottom-0.5 right-1.5 text-[10px] leading-none text-gray-400 sm:bottom-1 sm:right-2 sm:text-xs dark:text-gray-500"
      >
        {player.sitCount}
      </span>
    </div>
  );
}
