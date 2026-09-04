import { useDroppable } from '@dnd-kit/core';
import { useGameState } from '../state/context';
import { getPlayer } from '../state/gameLogic';
import type { DropTarget, TeamSide } from '../types';
import { PlayerCard } from './PlayerCard';

/** One player-sized slot on a team - a drop target for dnd-kit. Slots beyond
 * the court's current sizePerTeam aren't rendered at all by CourtView (see
 * the length-5 slots array comment in initialState.ts), so "can't drop on a
 * full team" needs no extra code: there's simply no empty slot to target. */
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
  const dropTarget: DropTarget = { kind: 'team-slot', teamId, slotIndex };
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${teamId}-${slotIndex}`, data: dropTarget });

  return (
    <div
      ref={setNodeRef}
      className={
        'rounded border border-dashed p-1 transition-colors ' +
        (isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-600')
      }
    >
      {player ? <PlayerCard player={player} side={side} /> : <div className="h-7" />}
    </div>
  );
}
