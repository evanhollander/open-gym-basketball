import { useTileSelection } from './TileSelection';
import type { DropTarget, Player, TeamSide } from '../types';

// Fixed (not app-theme-dependent) jersey text color + card tint, matching
// CourtView's SIDE_CONTAINER on the dugout each card sits in - a plain
// theme-driven card (bg-white dark:bg-ink-700) would fight the dugout color
// behind it instead of reading as part of it (e.g. a dark-mode card would go
// medium-gray on top of the white team's literally-white dugout). Only
// applies when `side` is set (a team slot) - the bench isn't jersey-colored,
// so it keeps the plain theme-driven treatment below.
const SIDE_TEXT: Record<TeamSide, string> = {
  white: 'text-ink-900',
  dark: 'text-plank-50',
};
const SIDE_CARD: Record<TeamSide, string> = {
  white: SIDE_TEXT.white + ' bg-plank-50 ring-ink-900/15 active:bg-plank-100',
  dark: SIDE_TEXT.dark + ' bg-ink-800 ring-plank-50/20 active:bg-ink-700',
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
        'relative block w-full select-none rounded-sm px-2 py-1.5 pr-10 text-left text-sm ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-400 focus-visible:ring-offset-1 sm:px-3 sm:py-2 sm:pr-12 ' +
        (selected
          ? 'ring-2 ring-hoop-500 bg-hoop-500/15 ' + (side ? SIDE_TEXT[side] : '')
          : side
            ? SIDE_CARD[side]
            : 'bg-white dark:bg-ink-700 ring-plank-300 dark:ring-ink-600 active:bg-plank-50 dark:active:bg-ink-600') +
        (shaking ? ' animate-tile-shake' : '')
      }
    >
      <span className="block truncate text-base font-semibold sm:text-lg">{player.name}</span>
      <span
        title={`Sat out ${player.sitCount} time${player.sitCount === 1 ? '' : 's'}`}
        className="absolute bottom-0.5 right-0.5 rounded-xs bg-ink-900 px-1 py-px font-display text-[10px] leading-tight tracking-wide text-hoop-400 tabular-nums sm:bottom-1 sm:right-1 sm:text-xs dark:bg-ink-950"
      >
        sat {player.sitCount}
      </span>
    </button>
  );
}
