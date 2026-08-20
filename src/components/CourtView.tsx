import { useGameState } from '../state/context';
import { getTeam } from '../state/gameLogic';
import type { Court } from '../types';
import { TeamSlot } from './TeamSlot';

interface TeamColumnProps {
  teamId: string;
  size: number;
  isWinnerPick: boolean;
  onPickWinner?: () => void;
}

function TeamColumn({ teamId, size, isWinnerPick, onPickWinner }: TeamColumnProps) {
  const state = useGameState();
  const team = getTeam(state, teamId)!;
  const teamNumber = teamId.split('-')[1];
  const label = `Team ${teamNumber} (${team.side === 'white' ? 'White' : 'Dark'})`;

  return (
    <div className="flex-1">
      {onPickWinner ? (
        // Once a round is underway, the team header doubles as the winner
        // picker - tap the team that won right where you're already looking,
        // instead of a separate dropdown panel elsewhere on the page.
        <button
          type="button"
          onClick={onPickWinner}
          aria-pressed={isWinnerPick}
          className={
            'mb-1 w-full rounded px-2 py-1.5 text-center text-sm font-semibold transition-colors ' +
            (isWinnerPick
              ? 'bg-green-600 text-white'
              : 'bg-blue-100 text-blue-950 active:bg-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:active:bg-blue-900')
          }
        >
          {label}
          {isWinnerPick ? ' ✓ Won' : ''}
        </button>
      ) : (
        <h3 className="mb-1 rounded bg-blue-100 px-2 py-1 text-center text-sm font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
          {label}
        </h3>
      )}
      <div className="flex flex-col gap-1">
        {team.slots.slice(0, size).map((playerId, i) => (
          <TeamSlot key={i} teamId={teamId} slotIndex={i} playerId={playerId} />
        ))}
      </div>
    </div>
  );
}

interface CourtViewProps {
  court: Court;
  /** Present only once a round is underway (see RotationBoard) - lets the
   * team headers act as winner-pick buttons instead of plain labels. */
  selectedWinnerTeamId?: string | null;
  onSelectWinner?: (teamId: string) => void;
}

export function CourtView({ court, selectedWinnerTeamId, onSelectWinner }: CourtViewProps) {
  return (
    <div
      className={
        'rounded border p-3 transition-colors ' +
        (selectedWinnerTeamId ? 'border-green-400 dark:border-green-700' : 'border-gray-300 dark:border-gray-600')
      }
    >
      <h2 className="mb-2 text-center text-lg font-semibold">Court {court.index}</h2>
      <div className="flex gap-2">
        <TeamColumn
          teamId={court.teamAId}
          size={court.sizePerTeam}
          isWinnerPick={selectedWinnerTeamId === court.teamAId}
          onPickWinner={onSelectWinner ? () => onSelectWinner(court.teamAId) : undefined}
        />
        <TeamColumn
          teamId={court.teamBId}
          size={court.sizePerTeam}
          isWinnerPick={selectedWinnerTeamId === court.teamBId}
          onPickWinner={onSelectWinner ? () => onSelectWinner(court.teamBId) : undefined}
        />
      </div>
    </div>
  );
}
