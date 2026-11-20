import { useGameState } from '../state/context';
import { getPlayer } from '../state/gameLogic';
import { useTileSelection } from './TileSelection';
import type { DropTarget, TeamSide } from '../types';
import { PlayerCard } from './PlayerCard';

// Empty-slot dashed border, tinted to read against its own dugout color
// (see SIDE_CONTAINER in CourtView.tsx) rather than the app's light/dark
// theme - a theme-driven border would go invisible-on-invisible whenever
// e.g. the dark team's near-black dugout landed in dark app theme too.
const SIDE_SLOT_BORDER = {
  white: 'border-ink-900/20',
  dark: 'border-plank-50/25',
} as const;

/** One player-sized slot on a team - a tap target for the selected player.
 * Slots beyond the court's current sizePerTeam aren't rendered at all by
 * CourtView (see the length-5 slots array comment in initialState.ts), so
 * "can't tap a full team" needs no extra code: there's simply no empty slot
 * to render as a target. */
export function TeamSlot({
  teamId,
  slotIndex,
  playerId,
  side,
}: {
  teamId: string;
  slotIndex: number;
  playerId: string | null;
  side: TeamSide;
}) {
  const state = useGameState();
  const player = playerId ? getPlayer(state, playerId) : undefined;
  const { selectedPlayerId, onTileClick } = useTileSelection();
  const target: DropTarget = { kind: 'team-slot', teamId, slotIndex };

  return (
    <div
      className={
        'rounded-sm border-2 border-dashed p-1 transition-colors ' +
        (!player && selectedPlayerId ? 'border-line-400 dark:border-line-500' : SIDE_SLOT_BORDER[side])
      }
    >
      {player ? (
        <PlayerCard player={player} side={side} target={target} />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTileClick(null, target);
          }}
          aria-label={`Empty slot on team ${teamId.split('-')[1]}`}
          className="h-7 w-full rounded"
        />
      )}
    </div>
  );
}
