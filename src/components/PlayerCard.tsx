import { useDraggable } from '@dnd-kit/core';
import type { Player, TeamSide } from '../types';

// A small swatch on each player row is the only thing (besides the header
// above) that signals which team they're on, which mattered most in dark
// mode, where a slot's own border/background gives no such cue. Distinguish
// the two sides by shape (filled vs. hollow), both in the same neutral gray
// tone, rather than trying to recreate literal white/black jersey fills - a
// "white" fill is invisible on the card's own white background in light
// mode, and a "dark" fill is invisible on the card's own dark background in
// dark mode; either one just reproduces the same contrast problem one level
// down depending on theme.
const SIDE_DOT: Record<TeamSide, string> = {
  white: 'bg-gray-400 dark:bg-gray-300',
  dark: 'bg-transparent ring-2 ring-gray-400 dark:ring-gray-300',
};

/** A single player, shown on a team slot or the bench. Draggable to any
 * open team slot or the bench - see RotationBoard.tsx for the DndContext
 * that makes this work, and dragDrop.ts for how a drop gets turned into a
 * MOVE_PLAYER action. `side` is only passed when this card is on a team
 * slot (see TeamSlot.tsx) - omitted on the bench, where there's no team to
 * indicate. */
export function PlayerCard({ player, side }: { player: Player; side?: TeamSide }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      // touch-none stops the browser's own scroll gesture from fighting the
      // TouchSensor's drag recognition on phones. pr-9 leaves room for the
      // sit-count badge so long names ellipsis before running under it.
      // focus-visible ring is the keyboard-drag entry point's only visual
      // cue (dnd-kit's KeyboardSensor drags via Tab + Space/arrows/Space).
      className={
        // Sized for a phone by default; sm:/lg: steps bump text and padding
        // up on tablet/desktop/Chromebook screens instead of leaving a
        // phone-sized card centered in a bunch of unused space.
        'relative touch-none select-none rounded px-2 py-1.5 pr-9 text-sm shadow-sm ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:px-3 sm:py-2 sm:pr-11 bg-white ring-gray-200 dark:bg-gray-800 dark:ring-gray-700 ' +
        (isDragging ? 'opacity-30' : 'cursor-grab active:cursor-grabbing')
      }
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {side && (
          <span
            title={side === 'white' ? 'White team' : 'Dark team'}
            className={'inline-block h-2.5 w-2.5 shrink-0 rounded-full ' + SIDE_DOT[side]}
          />
        )}
        <span className="block truncate text-base font-semibold sm:text-lg">{player.name}</span>
      </span>
      <span
        title={`Sat out ${player.sitCount} time${player.sitCount === 1 ? '' : 's'}`}
        className="absolute bottom-0.5 right-1.5 text-[10px] leading-none text-gray-500 sm:bottom-1 sm:right-2 sm:text-xs dark:text-gray-400"
      >
        sat {player.sitCount}
      </span>
    </div>
  );
}
