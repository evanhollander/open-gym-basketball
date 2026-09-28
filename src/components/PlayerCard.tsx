import { useTileSelection } from './TileSelection';
import type { DropTarget, Player, TeamSide } from '../types';

// Same fixed jersey colors as CourtView's SIDE_STYLES (reused, not
// reinvented - that map already proves out at this exact bg+ring
// combination in both themes for the header, so the dot gets the same
// treatment instead of a separate "filled vs. hollow, same gray" scheme
// that technically had enough contrast but visually read backwards: a gray
// dot for "White" and a near-white dot for "Dark" doesn't match either
// label at a glance, which is the whole point of the dot.
const SIDE_DOT: Record<TeamSide, string> = {
  white: 'bg-white ring-2 ring-gray-300',
  dark: 'bg-gray-900 ring-2 ring-gray-500',
};

/** A single player, shown on a team slot or the bench. Tap to select it
 * (highlighted), then tap another tile to move/swap it there - see
 * TileSelection.tsx for the shared selection state and RotationBoard.tsx
 * for the click-handling and slide/shake animations. `target` is where this
 * card currently lives (its own team slot or the bench), so a tap on it
 * while a *different* card is already selected can act as the move's
 * destination. `side` is only passed when this card is on a team slot (see
 * TeamSlot.tsx) - omitted on the bench, where there's no team to indicate. */
export function PlayerCard({ player, side, target }: { player: Player; side?: TeamSide; target: DropTarget }) {
  const { selectedPlayerId, shakingPlayerId, onTileClick, registerCardRef } = useTileSelection();
  const selected = selectedPlayerId === player.id;
  const shaking = shakingPlayerId === player.id;

  return (
    <button
      type="button"
      ref={(el) => registerCardRef(player.id, el)}
      onClick={(e) => {
        // Stops this from also bubbling up to RotationBoard's background
        // click handler, which would otherwise treat every tap as "tapped
        // away" and immediately shake-cancel whatever this click just did.
        e.stopPropagation();
        onTileClick(player.id, target);
      }}
      // Sized for a phone by default; sm:/lg: steps bump text and padding
      // up on tablet/desktop/Chromebook screens instead of leaving a
      // phone-sized card centered in a bunch of unused space. pr-9 leaves
      // room for the sit-count badge so long names ellipsis before running
      // under it. animate-tile-shake/pop are plain CSS keyframes (see
      // index.css) - no animation library needed for a tap-highlight,
      // tap-away-shake, tap-target-slide interaction this small.
      className={
        'relative block w-full select-none rounded px-2 py-1.5 pr-9 text-left text-sm shadow-sm ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:px-3 sm:py-2 sm:pr-11 bg-white dark:bg-gray-800 ' +
        (selected
          ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-950'
          : 'ring-gray-200 dark:ring-gray-700 active:bg-gray-50 dark:active:bg-gray-700') +
        (shaking ? ' animate-tile-shake' : '')
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
    </button>
  );
}
