import { useGameState } from '../state/context';
import { getPlayer } from '../state/gameLogic';
import { useTileSelection } from './TileSelection';
import type { DropTarget, TeamSide } from '../types';
import { PlayerCard } from './PlayerCard';

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
        'rounded border border-dashed p-1 transition-colors ' +
        (!player && selectedPlayerId ? 'border-blue-400 dark:border-blue-600' : 'border-gray-300 dark:border-gray-600')
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
