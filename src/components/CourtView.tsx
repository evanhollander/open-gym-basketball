import { useGameState } from '../state/context';
import { getTeam } from '../state/gameLogic';
import type { Court } from '../types';
import { TeamSlot } from './TeamSlot';

function TeamColumn({ teamId, size }: { teamId: string; size: number }) {
  const state = useGameState();
  const team = getTeam(state, teamId)!;
  const teamNumber = teamId.split('-')[1];
  const label = `Team ${teamNumber} (${team.side === 'white' ? 'White' : 'Dark'})`;

  return (
    <div className="flex-1">
      <h3 className="mb-1 rounded bg-blue-100 px-2 py-1 text-center text-sm font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
        {label}
      </h3>
      <div className="flex flex-col gap-1">
        {team.slots.slice(0, size).map((playerId, i) => (
          <TeamSlot key={i} teamId={teamId} slotIndex={i} playerId={playerId} />
        ))}
      </div>
    </div>
  );
}

export function CourtView({ court }: { court: Court }) {
  return (
    <div className="rounded border border-gray-300 p-3 dark:border-gray-600">
      <h2 className="mb-2 text-center text-lg font-semibold">Court {court.index}</h2>
      <div className="flex gap-2">
        <TeamColumn teamId={court.teamAId} size={court.sizePerTeam} />
        <TeamColumn teamId={court.teamBId} size={court.sizePerTeam} />
      </div>
    </div>
  );
}
